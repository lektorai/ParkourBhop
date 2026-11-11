#!/usr/bin/env python3
"""Сборка словарей игры из открытых источников.

Запускается редко (при обновлении источников или стоп-листа). Результат лежит в git:
  data/dict/main.tsv      — основной словарь: слово<TAB>частота на миллион, по убыванию
  data/dict/extended.txt  — расширенный словарь (все допустимые существительные), по алфавиту

Источники (лицензии — в LICENSES.md):
  1. Морфологический словарь OpenCorpora в сборке pymorphy3-dicts-ru (CC BY-SA 3.0):
     часть речи, начальная форма, пометы (имя, фамилия, топоним, аббревиатура…).
  2. Harrix/Russian-Nouns (MIT): список нарицательных существительных.
  3. hermitdave/FrequencyWords, ru_full.txt (CC BY-SA 4.0): частоты словоформ.

Подготовка:
  python3 -m venv .venv && .venv/bin/pip install pymorphy3 pymorphy3-dicts-ru
  mkdir -p data/raw && cd data/raw
  curl -LO https://raw.githubusercontent.com/Harrix/Russian-Nouns/main/dist/russian_nouns.txt
  curl -LO https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_full.txt
  cd ../.. && .venv/bin/python scripts/build-dictionary.py
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

import pymorphy3

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "dict"

MAIN_SIZE = 15000        # ориентир ТЗ: 15–25 тыс. слов; хвост частотного списка слишком шумный
MIN_LEN = 3
MAX_LEN = 13             # длиннее исходного слова ничего составить нельзя
WORD_RE = re.compile(r"^[а-я]+$")

# Пометы OpenCorpora, с которыми слово не годится вообще.
BAD_ANY = {"Name", "Surn", "Patr", "Geox", "Orgn", "Trad", "Abbr", "Init", "Erro", "Dist", "Slng"}
# Пометы, с которыми слово годится только как бонусное (разговорное, устаревшее).
BAD_MAIN = {"Infr", "Arch", "Litr"}


def norm(word: str) -> str:
    return word.lower().replace("ё", "е")


def load_patterns(path: Path) -> tuple[set[str], list[str]]:
    exact: set[str] = set()
    prefixes: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = norm(line.strip())
        if not line or line.startswith("#"):
            continue
        if line.endswith("*"):
            prefixes.append(line[:-1])
        else:
            exact.add(line)
    return exact, prefixes


def matches(word: str, exact: set[str], prefixes: list[str]) -> bool:
    return word in exact or any(word.startswith(p) for p in prefixes)


def is_lemma_parse(p) -> bool:
    tag = p.tag
    if tag.POS != "NOUN" or "nomn" not in tag:
        return False
    if not ("sing" in tag or "Pltm" in tag):
        return False
    if p.normal_form != p.word:
        return False
    return not (BAD_ANY & tag.grammemes)


def main() -> None:
    morph = pymorphy3.MorphAnalyzer()
    block_exact, block_prefixes = load_patterns(ROOT / "data" / "blocklist.txt")

    # 1. Существительные OpenCorpora в начальной форме.
    oc_all: set[str] = set()
    oc_main_ok: set[str] = set()
    for p in morph.iter_known_word_parses():
        if not is_lemma_parse(p):
            continue
        w = norm(p.word)
        if not WORD_RE.match(w) or not (MIN_LEN <= len(w) <= MAX_LEN):
            continue
        oc_all.add(w)
        if not (BAD_MAIN & p.tag.grammemes):
            oc_main_ok.add(w)
    print(f"OpenCorpora: {len(oc_all)} существительных, из них без помет разг./устар.: {len(oc_main_ok)}")

    # 2. Список Harrix.
    harrix: set[str] = set()
    for line in (RAW / "russian_nouns.txt").read_text(encoding="utf-8").splitlines():
        w = norm(line.strip())
        if WORD_RE.match(w) and MIN_LEN <= len(w) <= MAX_LEN:
            harrix.add(w)
    print(f"Harrix: {len(harrix)}")

    # Слово из Harrix, которое OpenCorpora знает только как имя/топоним/аббревиатуру, не берём.
    def harrix_ok(w: str) -> bool:
        if w in oc_all:
            return True
        parses = [p for p in morph.parse(w) if p.is_known]
        if not parses:
            return True  # OpenCorpora слова не знает — верим толковому словарю
        return any(p.tag.POS == "NOUN" and not (BAD_ANY & p.tag.grammemes) for p in parses)

    extended = {w for w in oc_all | {h for h in harrix if harrix_ok(h)}
                if not matches(w, block_exact, block_prefixes)}
    print(f"Расширенный словарь: {len(extended)}")

    # 3. Частоты: сумма по словоформам, вес — вероятность разбора по OpenCorpora.
    #    Форма часто принадлежит сразу двум словам («баз» — это и «база», и редкое «баз»),
    #    поэтому отдельно считаем частоту форм, которые есть только у этого слова.
    #    Часть частоты, не подтверждённая такими формами, идёт с понижающим весом.
    UNIQUE_FACTOR = 4
    AMBIGUOUS_WEIGHT = 0.25
    weighted: dict[str, float] = defaultdict(float)
    unique: dict[str, float] = defaultdict(float)
    total = 0
    with (RAW / "ru_full.txt").open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            parts = line.split()
            if len(parts) != 2:
                continue
            form, count = norm(parts[0]), int(parts[1])
            total += count
            if count < 3 or not WORD_RE.match(form):
                continue
            parses = [p for p in morph.parse(form) if p.is_known]
            lemmas = {norm(p.normal_form) for p in parses}
            for p in parses:
                if p.tag.POS != "NOUN" or (BAD_ANY & p.tag.grammemes):
                    continue
                weighted[norm(p.normal_form)] += count * p.score
            if len(lemmas) == 1 and all(p.tag.POS == "NOUN" for p in parses):
                unique[next(iter(lemmas))] += count
            if i % 200000 == 0:
                print(f"  частоты: {i} строк", file=sys.stderr)
    freq = {w: min(v, UNIQUE_FACTOR * unique.get(w, 0) + AMBIGUOUS_WEIGHT * v)
            for w, v in weighted.items()}

    # 4. Основной словарь: слово есть в обоих источниках, без помет, самые частотные.
    candidates = [w for w in extended if w in oc_main_ok and w in harrix and freq.get(w, 0) > 0]
    candidates.sort(key=lambda w: (-freq[w], w))
    main_words = candidates[:MAIN_SIZE]
    print(f"Основной словарь: {len(main_words)} (кандидатов {len(candidates)}), "
          f"порог частоты {freq[main_words[-1]] * 1e6 / total:.3f} ipm")

    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "main.tsv").open("w", encoding="utf-8") as fh:
        for w in main_words:
            fh.write(f"{w}\t{freq[w] * 1e6 / total:.3f}\n")
    (OUT / "extended.txt").write_text("\n".join(sorted(extended)) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
