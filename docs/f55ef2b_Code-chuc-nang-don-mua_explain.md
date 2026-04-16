# f55ef2b — feat: Code chức năng đơn mua

## 🎯 Tổng Quan

Commit này hoàn thiện trang **Lịch sử đơn mua** (`/user/purchase`). File thay đổi chính:

| File | Thay đổi |
|------|----------|
| `src/pages/User/pages/HistoryPurchase/HistoryPurchase.tsx` | Viết hoàn toàn UI + logic lọc đơn hàng theo trạng thái |

Chức năng bao gồm:
- **Tab lọc theo trạng thái** — Tất cả / Chờ xác nhận / Chờ lấy hàng / Đang giao / Đã giao / Đã hủy
- **Đọc trạng thái từ URL** — Tab active được xác định qua query string `?status=1`
- **Gọi API lấy danh sách đơn hàng** theo trạng thái đang chọn
- **Hiển thị từng đơn hàng** — ảnh, tên, số lượng, giá, tổng tiền

---

## 📋 Nội Dung Trang

```
┌──────────────────────────────────────────────────────────────┐
│  Tất cả │ Chờ xác nhận │ Chờ lấy hàng │ Đang giao │ ...    │  ← Tabs (NavLink)
├──────────────────────────────────────────────────────────────┤
│  [Ảnh]  Tên sản phẩm                          Giá gốc ~~~  │
│         x2                                     ₫120.000     │
│                                    Tổng giá tiền  ₫240.000  │
├──────────────────────────────────────────────────────────────┤
│  [Ảnh]  Tên sản phẩm 2 ...                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Thay Đổi Chi Tiết

### Bước 1: Khai báo dữ liệu tab tĩnh

```typescript
const purchaseTabs = [
  { status: purchasesStatus.all, name: 'Tất cả' },             // status = 0
  { status: purchasesStatus.waitForConfirmation, name: 'Chờ xác nhận' },  // status = 1
  { status: purchasesStatus.waitForGetting, name: 'Chờ lấy hàng' },      // status = 2
  { status: purchasesStatus.inProgress, name: 'Đang giao' },              // status = 3
  { status: purchasesStatus.delivered, name: 'Đã giao' },                 // status = 4
  { status: purchasesStatus.cancelled, name: 'Đã hủy' }                   // status = 5
]
```

**Tại sao khai báo ngoài component?**

Mảng này không thay đổi theo thời gian. Nếu đặt trong component → mỗi lần render React sẽ tạo lại mảng mới trong bộ nhớ mà không cần thiết. Đặt ngoài → tạo một lần, dùng mãi.

```typescript
// purchasesStatus trong constants/purchase.ts
export const purchasesStatus = {
  inCart: -1,
  all: 0,
  waitForConfirmation: 1,
  waitForGetting: 2,
  inProgress: 3,
  delivered: 4,
  cancelled: 5
} as const
// `as const` → TypeScript hiểu đây là literal type (0, 1, 2, ...) không phải number chung
```

---

### Bước 2: Đọc trạng thái từ URL

```typescript
const queryParams: { status?: string } = useQueryParams()
const status: number = Number(queryParams.status) || purchasesStatus.all
```

**`useQueryParams`** là custom hook đơn giản:

```typescript
// src/hooks/useQueryParams.tsx
import { useSearchParams } from 'react-router-dom'

export default function useQueryParams() {
  const [searchParams] = useSearchParams()
  return Object.fromEntries([...searchParams])
  // Với URL: /user/purchase?status=2
  // → trả về: { status: '2' }  ← luôn là string!
}
```

**Tại sao phải `Number(queryParams.status)`?**

URL query string luôn là dạng `string`. API và `purchasesStatus` cần `number`. Phải ép kiểu:

```typescript
// queryParams.status = '2' (string từ URL)
Number('2')       // → 2 (number) ✅
Number(undefined) // → NaN → falsy → dùng fallback

const status: number = Number(queryParams.status) || purchasesStatus.all
//                     ↑ Nếu NaN (URL không có status) → dùng 0 (Tất cả)
```

---

### Bước 3: Gọi API lấy danh sách đơn hàng

```typescript
const { data: purchasesInCartData } = useQuery({
  queryKey: ['purchases', { status }],
  queryFn: () => purchaseApi.getPurchases({ status: status as PurchaseListStatus })
})

const purchasesInCart = purchasesInCartData?.data.data
```

**`queryKey: ['purchases', { status }]`** — React Query cache kết quả theo key này:

```
queryKey = ['purchases', { status: 0 }] → cache riêng cho tab "Tất cả"
queryKey = ['purchases', { status: 1 }] → cache riêng cho tab "Chờ xác nhận"
queryKey = ['purchases', { status: 2 }] → cache riêng cho tab "Chờ lấy hàng"
...
```

Khi user chuyển tab → `status` thay đổi → `queryKey` thay đổi → React Query tự động gọi API mới. Nếu quay lại tab cũ → lấy từ cache (không gọi lại API).

**`status as PurchaseListStatus`** — ép kiểu để TypeScript không báo lỗi:

```typescript
// PurchaseListStatus = -1 | 0 | 1 | 2 | 3 | 4 | 5
// status ở đây là number thông thường → cần ép kiểu để pass vào API
```

---

### Bước 4: Render tab lọc — dùng `Link` + `createSearchParams`

```typescript
const purchaseTabsLink = purchaseTabs.map((tab) => (
  <Link
    key={tab.status}
    to={{
      pathname: path.historyPurchase,       // /user/purchase
      search: createSearchParams({
        status: String(tab.status)          // ?status=1, ?status=2, ...
      }).toString()
    }}
    className={classNames('flex flex-1 items-center justify-center border-b-2 bg-white py-4 text-center', {
      'border-b-orange text-orange': status === tab.status,    // Tab đang active
      'border-b-black/10 text-gray-900': status !== tab.status // Tab không active
    })}
  >
    {tab.name}
  </Link>
))
```

**`createSearchParams`** — hàm của React Router để tạo chuỗi query string:

```typescript
createSearchParams({ status: '1' }).toString()
// → 'status=1'

// Dùng trong to={{ search: ... }} thay vì tự ghép chuỗi thủ công:
// ❌ Thủ công:  `/user/purchase?status=${tab.status}`  — dễ lỗi với ký tự đặc biệt
// ✅ Đúng cách: createSearchParams({ status: String(tab.status) }).toString()
```

**`classNames` (thư viện `classnames`)** — kết hợp class có điều kiện:

```typescript
classNames(
  'class-luôn-có flex flex-1 ...',   // Class luôn áp dụng
  {
    'border-b-orange text-orange': status === tab.status,   // Thêm nếu điều kiện true
    'border-b-black/10 text-gray-900': status !== tab.status
  }
)
// Kết quả: 'flex flex-1 ... border-b-orange text-orange'  (nếu tab active)
//      hoặc: 'flex flex-1 ... border-b-black/10 text-gray-900' (nếu không active)
```

**Tại sao dùng `Link` thay vì `button` + `onClick`?**

| `Link` | `button + onClick + navigate` |
|--------|-------------------------------|
| URL thay đổi → có thể bookmark/share/back button hoạt động | URL không thay đổi |
| Browser prefetch | Không có |
| Đơn giản hơn — không cần handler | Cần viết hàm xử lý |

---

### Bước 5: Render danh sách đơn hàng

```tsx
{purchasesInCart?.map((purchase) => (
  <div key={purchase._id} className='mt-4 rounded-sm ... shadow-sm'>

    {/* Link đến trang chi tiết sản phẩm */}
    <Link to={`${path.home}${generateNameId({ name: purchase.product.name, id: purchase.product._id })}`}>
      
      {/* Ảnh sản phẩm */}
      <div className='shrink-0'>
        <img className='h-20 w-20 object-cover' src={purchase.product.image} alt={purchase.product.name} />
      </div>

      {/* Tên + số lượng */}
      <div className='ml-3 grow overflow-hidden'>
        <div className='truncate'>{purchase.product.name}</div>
        <div className='mt-3'>x{purchase.buy_count}</div>
      </div>

      {/* Giá gốc gạch ngang + giá hiện tại */}
      <div className='ml-3 shrink-0'>
        <span className='text-gray-500 line-through'>
          ₫{formatCurrency(purchase.product.price_before_discount)}
        </span>
        <span className='text-orange ml-2'>
          ₫{formatCurrency(purchase.product.price)}
        </span>
      </div>
    </Link>

    {/* Tổng tiền */}
    <div className='flex justify-end'>
      <span>Tổng giá tiền</span>
      <span className='text-orange ml-4 text-xl'>
        ₫{formatCurrency(purchase.product.price * purchase.buy_count)}
      </span>
    </div>
  </div>
))}
```

**`purchasesInCart?.map`** — Dấu `?.` (optional chaining):

```typescript
purchasesInCart?.map(...)
// Tương đương:
purchasesInCart !== undefined && purchasesInCart !== null
  ? purchasesInCart.map(...)
  : undefined

// Khi data chưa load (undefined) → không crash, chỉ render nothing
```

**`generateNameId`** — Tạo slug URL cho sản phẩm:

```typescript
generateNameId({ name: 'Áo thun nam', id: 'abc123' })
// → 'ao-thun-nam-i.abc123'
// URL đẹp, có thể đọc được, không bị lỗi ký tự đặc biệt
```

**`formatCurrency`** — Format số thành tiền tệ:

```typescript
formatCurrency(120000) // → '120.000'
// Thêm ký hiệu ₫ ở JSX: ₫{formatCurrency(price)}
```

---

## 🔄 Luồng Chạy Của Trang Đơn Mua

```
User vào /user/purchase
         ↓
useQueryParams() → đọc ?status từ URL
         ↓
status = Number(queryParams.status) || 0  (mặc định: Tất cả)
         ↓
useQuery(['purchases', { status }])  → gọi API getPurchases({ status })
         ↓
Render tab: tab có status === status hiện tại → active (cam)
         ↓
Render danh sách đơn hàng từ API
         ↓
         User click tab khác (ví dụ: "Chờ xác nhận")
         ↓
Link to={{ search: 'status=1' }} → URL đổi thành /user/purchase?status=1
         ↓
Component re-render → useQueryParams() trả về { status: '1' }
         ↓
status = 1 → queryKey thay đổi → React Query gọi API mới
         ↓
Tab "Chờ xác nhận" active, danh sách đơn hàng mới hiển thị
```

---

## 📌 Kiến Thức Mới Trong Commit Này

| Khái niệm | Giải thích |
|-----------|-----------|
| **`useQueryParams()`** | Custom hook bọc `useSearchParams()` — trả về object chứa tất cả query params từ URL dưới dạng `{ key: string }` |
| **`Number(str) \|\| fallback`** | Convert string từ URL sang number; nếu `NaN` (undefined/không hợp lệ) → dùng giá trị mặc định |
| **`queryKey` phụ thuộc state** | Khi key thay đổi → React Query tự gọi API mới + cache riêng cho từng key |
| **`createSearchParams({ })`** | React Router helper tạo query string an toàn — thay thế cho việc ghép chuỗi thủ công |
| **`classNames(base, { conditional })`** | Kết hợp class tĩnh + class có điều kiện — phổ biến cho active states, loading states |
| **`Link` thay vì button** | Thay đổi filter/tab bằng URL query param thay vì state — URL có thể bookmark, chia sẻ, back/forward |
| **`as const`** | TypeScript: giữ nguyên literal type (`0 \| 1 \| 2 \| ...`) thay vì mở rộng thành `number` |
| **`?.` (Optional Chaining)**  | Truy cập property/gọi method an toàn khi giá trị có thể là `null`/`undefined` — không cần if check |
| **Khai báo data tĩnh ngoài component** | Tránh tạo lại object/array không cần thiết mỗi lần re-render |
