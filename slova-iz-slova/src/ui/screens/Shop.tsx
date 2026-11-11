import { ECONOMY, PAID_THEMES, type ProductId } from '../../config/economy';
import { t, type TextKey } from '../../i18n';
import type { CatalogItem } from '../../platform';
import { TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconCoin, IconNoAds, IconPalette, IconVideo } from '../icons';

const COIN_PACKS: ProductId[] = ['coins_500', 'coins_1500', 'coins_5000'];
const EXTRAS: ProductId[] = ['no_ads', 'themes_all'];

function ProductIcon({ id }: { id: ProductId }) {
  if (id === 'no_ads') return <IconNoAds />;
  if (id === 'themes_all') return <IconPalette />;
  return <IconCoin />;
}

/** Цена всегда берётся из каталога площадки: число, название и иконка валюты (пункт 1.13.2). */
function Price({ item }: { item: CatalogItem }) {
  if (item.currencyImage) {
    return (
      <>
        {item.priceValue}
        <img src={item.currencyImage} alt={item.currencyCode} />
      </>
    );
  }
  return <>{item.price}</>;
}

export function Shop() {
  const game = useGame();
  const catalog = useAppState((s) => s.catalog);
  const catalogLoaded = useAppState((s) => s.catalogLoaded);
  const payments = useAppState((s) => s.payments);
  const save = useAppState((s) => s.save);
  const adLeft = game.adCoinsLeft;

  const owned = (id: ProductId) =>
    (id === 'no_ads' && save.noAds) || (id === 'themes_all' && PAID_THEMES.every((theme) => save.themes.includes(theme)));

  // В игре показываются только товары, которые есть в каталоге площадки.
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const section = (ids: ProductId[]) => ids.map((id) => byId.get(id)).filter((item): item is CatalogItem => Boolean(item));
  const packs = section(COIN_PACKS);
  const extras = section(EXTRAS);

  const buy = async (id: ProductId) => {
    game.sound('tap');
    const ok = await game.buyProduct(id);
    if (!ok) game.showToast('info', t('toast.purchaseFailed'));
  };

  const renderProduct = (item: CatalogItem) => (
    <section class="panel product" key={item.id} data-testid={`product-${item.id}`}>
      <div class="product-icon">
        <ProductIcon id={item.id} />
      </div>
      <div class="product-info">
        <h3 class="product-title">{t(`shop.product.${item.id}` as TextKey)}</h3>
        <p class="product-desc muted">{t(`shop.product.${item.id}.desc` as TextKey)}</p>
      </div>
      {owned(item.id) ? (
        <span class="chip">{t('shop.bought')}</span>
      ) : (
        <button type="button" class="btn product-buy" data-testid={`buy-${item.id}`} onClick={() => void buy(item.id)}>
          <Price item={item} />
        </button>
      )}
    </section>
  );

  return (
    <div class="screen" data-testid="screen-shop">
      <TopBar title={t('shop.title')} onBack={() => game.go('menu')} coinsShop={false} />
      <div class="scroll">
        <h2 class="section-title">{t('shop.free')}</h2>
        <section class="panel shop-free">
          <button
            type="button"
            class="btn"
            data-testid="ad-coins"
            disabled={adLeft <= 0}
            onClick={async () => {
              const ok = await game.watchAdForCoins();
              if (!ok) game.showToast('info', t('toast.noReward'));
            }}
          >
            <IconVideo />
            {t('shop.freeButton', { n: ECONOMY.adCoinsReward })}
          </button>
          <p class="muted" data-testid="ad-coins-left">
            {adLeft > 0 ? t('shop.freeLeft', { n: adLeft, max: ECONOMY.adCoinsPerDay }) : t('shop.freeDone')}
          </p>
        </section>

        {packs.length > 0 && <h2 class="section-title">{t('shop.coins')}</h2>}
        {packs.map(renderProduct)}
        {extras.length > 0 && <h2 class="section-title">{t('shop.extras')}</h2>}
        {extras.map(renderProduct)}

        {payments && !catalogLoaded && <p class="section-title muted">{t('common.loading')}</p>}
        {catalogLoaded && packs.length + extras.length === 0 && (
          <p class="section-title muted" data-testid="shop-unavailable">
            {t('shop.unavailable')}
          </p>
        )}
      </div>
    </div>
  );
}
