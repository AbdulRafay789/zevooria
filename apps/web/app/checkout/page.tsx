'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { useCart } from '../../components/cart-provider';
import { useCatalogProducts } from '../../components/catalog-provider';
import { formatProductPrice } from '../../lib/catalog';
import {
  CommerceApiError,
  createOrder,
  fetchAddresses,
  validatePromoCode,
  type CustomerAddress,
} from '../../lib/commerce-api';
import {
  lineTotalWholePkr,
  parseWholePkr,
  sumWholePkr,
} from '../../lib/money';
import { PAKISTAN_CITIES, shippingPkrForCity } from '../../lib/pakistan-cities';
import {
  isValidPakistanPhone,
  normalizePakistanPhone,
  PK_PHONE_MESSAGE,
} from '../../lib/phone';
import { PhoneField } from '../../components/phone-field';
import { RequireAuth } from '../../components/require-auth';
import styles from '../auth-forms.module.css';

function CheckoutPageContent() {
  const { user, ready } = useAuth();
  const { items, clear } = useCart();
  const products = useCatalogProducts();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [pending, setPending] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const idempotencyRef = useRef(
    `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    fetchAddresses()
      .then((rows) => {
        setSavedAddresses(rows);
        const def = rows.find((row) => row.isDefault) ?? rows[0];
        if (def) {
          setSelectedAddressId(def.id);
          setCity(def.city);
        }
      })
      .catch(() => {
        // Address book is optional for checkout.
      });
  }, [ready, user]);

  const selectedAddress =
    savedAddresses.find((row) => row.id === selectedAddressId) ?? null;

  useEffect(() => {
    if (selectedAddress?.city) {
      setCity(selectedAddress.city);
    }
  }, [selectedAddress?.city]);

  const priced = useMemo(() => {
    return items
      .map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return product ? { item, product } : null;
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));
  }, [items, products]);

  const subtotal = useMemo(() => {
    try {
      return sumWholePkr(
        priced.map(({ item, product }) =>
          lineTotalWholePkr(parseWholePkr(product.price), item.quantity),
        ),
      );
    } catch {
      return 0;
    }
  }, [priced]);

  const shippingEstimate = city ? shippingPkrForCity(city) : 0;
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const merchandiseNet = Math.max(0, subtotal - discountAmount);
  const totalEstimate = sumWholePkr([merchandiseNet, shippingEstimate]);

  useEffect(() => {
    if (!appliedPromo) {
      return;
    }
    if (subtotal < 1599) {
      setAppliedPromo(null);
      setPromoError('Promo removed — merchandise is below the minimum.');
    }
  }, [subtotal, appliedPromo]);

  async function onApplyPromo() {
    setPromoError(null);
    const code = promoInput.trim();
    if (!code) {
      setPromoError('Enter a promo code.');
      return;
    }
    setPromoPending(true);
    try {
      const result = await validatePromoCode({
        code,
        subtotalPkr: subtotal,
      });
      setAppliedPromo({
        code: result.code,
        discountAmount: Math.trunc(Number(result.discountAmount)),
      });
      setPromoInput(result.code);
    } catch (err: unknown) {
      setAppliedPromo(null);
      setPromoError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to apply promo code.',
      );
    } finally {
      setPromoPending(false);
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || items.length === 0 || pending) {
      return;
    }
    setError(null);
    setCityError(null);
    const form = new FormData(event.currentTarget);
    const selectedCity = String(form.get('city') ?? '');
    if (!selectedCity) {
      setCityError('Select city');
      return;
    }
    const customerPhoneRaw = String(form.get('customerPhone') ?? '');
    if (!isValidPakistanPhone(customerPhoneRaw)) {
      setError(PK_PHONE_MESSAGE);
      return;
    }
    const customerPhone = normalizePakistanPhone(customerPhoneRaw)!;

    setPending(true);

    try {
      const order = await createOrder({
        customerName: String(form.get('customerName') ?? ''),
        customerEmail: String(form.get('customerEmail') ?? ''),
        customerPhone,
        shippingAddress: {
          line1: String(form.get('line1') ?? ''),
          line2: String(form.get('line2') ?? '') || undefined,
          city: selectedCity,
          postalCode: String(form.get('postalCode') ?? ''),
          country: 'Pakistan',
        },
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paymentMethod: 'COD',
        idempotencyKey: idempotencyRef.current,
        promoCode: appliedPromo?.code,
      });
      clear();
      router.push(`/order-confirmation/${order.id}`);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to place order. Please try again.',
      );
      idempotencyRef.current = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    } finally {
      setPending(false);
    }
  };

  if (!ready || !user) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.eyebrow}>Checkout</p>
          <h1 className={styles.title}>Your bag is empty</h1>
          <p className={styles.lede}>
            Add fragrances before continuing to checkout.
          </p>
          <p className={styles.alt}>
            <Link href="/collection">Continue shopping</Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${styles.wide}`}>
        <p className={styles.eyebrow}>Checkout</p>
        <h1 className={styles.title}>Place order</h1>
        <p className={styles.lede}>
          Cash on delivery — payment is collected when your order arrives.
        </p>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {savedAddresses.length > 0 ? (
            <label className={styles.field}>
              <span>Saved address</span>
              <select
                value={selectedAddressId}
                onChange={(event) => setSelectedAddressId(event.target.value)}
              >
                {savedAddresses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.isDefault ? 'Default · ' : ''}
                    {row.line1}, {row.city}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.field}>
            <span>Full name</span>
            <input
              name="customerName"
              type="text"
              required
              defaultValue={user.fullName}
              autoComplete="name"
            />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              name="customerEmail"
              type="email"
              required
              defaultValue={user.email}
              autoComplete="email"
            />
          </label>
          <PhoneField
            name="customerPhone"
            label="Phone"
            defaultValue={user.phone}
          />
          <label className={styles.field}>
            <span>Address</span>
            <input
              key={`line1-${selectedAddress?.id ?? 'new'}`}
              name="line1"
              type="text"
              required
              minLength={5}
              defaultValue={selectedAddress?.line1 ?? ''}
              autoComplete="street-address"
            />
          </label>
          <label className={styles.field}>
            <span>Address line 2 (optional)</span>
            <input
              key={`line2-${selectedAddress?.id ?? 'new'}`}
              name="line2"
              type="text"
              defaultValue={selectedAddress?.line2 ?? ''}
              autoComplete="address-line2"
            />
          </label>
          <label className={styles.field}>
            <span>City</span>
            <select
              key={`city-${selectedAddress?.id ?? 'new'}`}
              name="city"
              required
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setCityError(null);
              }}
              aria-invalid={Boolean(cityError)}
            >
              <option value="" disabled>
                Select city
              </option>
              {PAKISTAN_CITIES.map((cityOption) => (
                <option key={cityOption} value={cityOption}>
                  {cityOption}
                </option>
              ))}
            </select>
            {cityError ? (
              <span className={styles.fieldError}>{cityError}</span>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>Postal code</span>
            <input
              key={`postal-${selectedAddress?.id ?? 'new'}`}
              name="postalCode"
              type="text"
              required
              minLength={4}
              defaultValue={selectedAddress?.postalCode ?? ''}
              autoComplete="postal-code"
            />
          </label>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Order summary</h2>
            {priced.map(({ item, product }) => (
              <div key={item.productId} className={styles.summaryLine}>
                <span>
                  {product.name} × {item.quantity}
                </span>
                <span>
                  {formatProductPrice(
                    product.currency,
                    `${lineTotalWholePkr(parseWholePkr(product.price), item.quantity)}.00`,
                  )}
                </span>
              </div>
            ))}
            <div className={styles.summaryLine}>
              <span>Subtotal (exclusive)</span>
              <strong>{formatProductPrice('PKR', `${subtotal}.00`)}</strong>
            </div>
            <div className={styles.promoRow}>
              <label className={styles.field}>
                <span>Promo code</span>
                <input
                  value={promoInput}
                  onChange={(event) => {
                    setPromoInput(event.target.value);
                    setPromoError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }
                    // Promo sits inside the order form; Enter must apply, not place the order.
                    event.preventDefault();
                    if (!promoPending && subtotal > 0) {
                      void onApplyPromo();
                    }
                  }}
                  placeholder="Enter code"
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-describedby={promoError ? 'checkout-promo-error' : undefined}
                />
              </label>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={promoPending || subtotal <= 0}
                onClick={() => {
                  void onApplyPromo();
                }}
              >
                {promoPending ? 'Checking…' : 'Apply'}
              </button>
              {appliedPromo ? (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoError(null);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {promoError ? (
              <p id="checkout-promo-error" className={styles.fieldError}>
                {promoError}
              </p>
            ) : null}
            {appliedPromo ? (
              <div className={styles.summaryLine}>
                <span>Promo ({appliedPromo.code})</span>
                <strong>
                  −{formatProductPrice('PKR', `${discountAmount}.00`)}
                </strong>
              </div>
            ) : null}
            <div className={styles.summaryLine}>
              <span>Delivery charges</span>
              <span>
                {city
                  ? formatProductPrice('PKR', `${shippingEstimate}.00`)
                  : 'Select city'}
              </span>
            </div>
            <div className={`${styles.summaryLine} ${styles.summaryTotal}`}>
              <span>Net total</span>
              <strong>
                {formatProductPrice('PKR', `${totalEstimate}.00`)}
              </strong>
            </div>
            <p className={styles.note}>
              Delivery is PKR 250 for Karachi and PKR 500 for other cities.
              Promo codes apply to merchandise only — delivery is never
              discounted. Net total = subtotal − promo + delivery.
            </p>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Placing order…' : 'Place COD order'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth next="/checkout">
      <CheckoutPageContent />
    </RequireAuth>
  );
}
