import { descriptionToListItems } from '../lib/product-description';
import styles from './product-description.module.css';

export function ProductDescription({ text }: { text: string }) {
  const items = descriptionToListItems(text);
  if (items.length === 0) {
    return null;
  }
  if (items.length === 1 && !text.includes('<li') && !text.includes('\n')) {
    return <p className={styles.prose}>{items[0]}</p>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}
