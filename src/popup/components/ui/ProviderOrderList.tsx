import React from 'react';
import SortableList from './SortableList.js';
interface Props<T extends string> { items: T[]; name: (id: T) => string; onReorder: (items: T[]) => void; children: (id: T) => React.ReactNode; }
export default function ProviderOrderList<T extends string>(props: Props<T>): React.ReactElement {
  return <SortableList {...props} className="provider-order-list" rowClassName="photo-search-settings__provider" />;
}
