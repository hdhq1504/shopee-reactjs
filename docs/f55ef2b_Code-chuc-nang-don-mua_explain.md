# f55ef2b — feat: Code chức năng Đơn mua (Lịch sử mua hàng)

## Tổng Quan

Commit này hoàn thiện trang **HistoryPurchase** (Đơn mua), đây là trang hiển thị danh sách tất cả đơn hàng của user lọc theo trạng thái.

Có 3 điểm quan trọng:
1. **Lọc theo trạng thái** — dùng query params trên URL để lọc đơn hàng (Tất cả, Chờ xác nhận, Đang giao...)
2. **Tab navigation** — khi bấm tab, URL thay đổi → data tự load lại
3. **Tính tổng tiền bằng `useMemo`** — performance tốt hơn so với tính trong render

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/HistoryPurchase/HistoryPurchase.tsx` | Sửa lớn | Thêm API call, tab filter, hiển thị danh sách |
| `src/types/purchase.type.ts` | Sửa nhỏ | Thêm `purchasesStatus` constant |

---

## 1. `purchase.type.ts` — Thêm `purchasesStatus` Constant

```typescript
export const purchasesStatus = {
  inCart: -1,           // Đang trong giỏ hàng (chưa đặt)
  all: 0,               // Tất cả đơn hàng
  waitForConfirmation: 1, // Chờ xác nhận từ người bán
  waitForGetting: 2,    // Người bán đã xác nhận, chờ lấy hàng
  inProgress: 3,        // Đang giao hàng
  delivered: 4,         // Đã giao hàng thành công
  cancelled: 5          // Đã huỷ
} as const
```

**`as const`** — TypeScript biến literal type thành **readonly** và **narrow** nhất có thể:

```typescript
// Không có as const:
purchasesStatus.inCart  // TypeScript thấy: type là 'number'

// Với as const:
purchasesStatus.inCart  // TypeScript thấy: type là literal '-1' (không phải number chung)

// Lợi ích: Nếu hàm cần tham số kiểu PurchaseStatus:
type PurchaseStatusType = typeof purchasesStatus[keyof typeof purchasesStatus]
// → -1 | 0 | 1 | 2 | 3 | 4 | 5
// TypeScript sẽ báo lỗi nếu truyền vào status không hợp lệ (ví dụ: 99)
```

Đặt constant này trong file `purchase.type.ts` vì nó gắn chặt với khái niệm `Purchase` — mọi code liên quan đến purchase status đều import từ một chỗ.

---

## 2. `HistoryPurchase.tsx` — Chi Tiết Logic

### Đọc status từ URL với `useQueryParams`

```typescript
const { status = purchasesStatus.all } = useQueryParams()
```

**`useQueryParams()`** đọc query params từ URL và trả về object. Ví dụ:

```
URL: /user/purchase?status=1
→ useQueryParams() = { status: '1' }
→ destructure: status = '1'

URL: /user/purchase (không có query)
→ useQueryParams() = {}
→ destructure: status = 0 (dùng default value purchasesStatus.all)
```

**Tại sao lọc bằng URL thay vì state?**

| Cách | Ưu điểm | Nhược điểm |
|------|---------|-----------|
| `useState` | Đơn giản | Reload trang mất trạng thái, không thể share URL |
| **URL query params** (đang dùng) | Reload vẫn giữ trạng thái, có thể share link, back/forward hoạt động | Cần parse từ string |

User copy URL `/user/purchase?status=3` gửi cho bạn → bạn mở cũng đang xem tab "Đang giao".

### Gọi API với `useQuery`

```typescript
const { data: purchasesInPurchaseData } = useQuery({
  queryKey: ['purchases', { status }],
  queryFn: () => purchaseApi.getPurchases({ status: Number(status) as PurchaseListStatus }),
  enabled: Boolean(isAuthenticated)
})

const purchasesInPurchase = purchasesInPurchaseData?.data.data
```

**`queryKey: ['purchases', { status }]`** — Khi `status` thay đổi (user bấm tab khác), React Query tự động gọi lại API vì key thay đổi. Data cũ được cache riêng cho mỗi `status`.

**`Number(status)`** — Các query params từ URL luôn là string (`'1'`, `'2'`...). API cần number → parse trước khi gửi.

**`as PurchaseListStatus`** — TypeScript assertion vì `Number(status)` có thể là bất kỳ số nào, nhưng ta biết URL chỉ chứa các giá trị hợp lệ (từ đường link tab).

### Hàm tính tổng tiền với `useMemo`

```typescript
const totalCheckedPurchasePrice = useMemo(
  () =>
    purchasesInPurchase?.reduce((result, current) => {
      return result + current.price * current.buy_count
    }, 0),
  [purchasesInPurchase]
)
```

**`reduce`** duyệt qua mảng và cộng dồn:

```
purchasesInPurchase = [
  { price: 100000, buy_count: 2 },   → +200000
  { price: 50000,  buy_count: 1 },   → +50000
]

result qua các vòng lặp:
  vòng 1: result = 0       + 100000*2  = 200000
  vòng 2: result = 200000  + 50000*1   = 250000

Kết quả = 250000
```

**Tại sao dùng `useMemo`?**

```typescript
// Không có useMemo → tính lại mỗi khi render
const totalPrice = purchasesInPurchase?.reduce(...)

// Có useMemo → tính lại CHỈ KHI purchasesInPurchase thay đổi
const totalPrice = useMemo(() => purchasesInPurchase?.reduce(...), [purchasesInPurchase])
```

Khi component re-render vì lý do khác (ví dụ parent re-render, context thay đổi), `reduce` không cần chạy lại nếu `purchasesInPurchase` không đổi. Với danh sách dài, đây là tối ưu đáng kể.

---

## 3. UI: Tab Navigation Theo Status

```tsx
const purchaseTabs = [
  { status: purchasesStatus.all, name: 'Tất cả' },
  { status: purchasesStatus.waitForConfirmation, name: 'Chờ xác nhận' },
  { status: purchasesStatus.waitForGetting, name: 'Chờ lấy hàng' },
  { status: purchasesStatus.inProgress, name: 'Đang giao' },
  { status: purchasesStatus.delivered, name: 'Đã giao' },
  { status: purchasesStatus.cancelled, name: 'Đã huỷ' }
]

{purchaseTabs.map((tab) => (
  <Link
    key={tab.status}
    to={{
      pathname: path.historyPurchase,
      search: createSearchParams({ status: String(tab.status) }).toString()
    }}
    className={classNames('flex flex-1 items-center justify-center border-b-2 bg-white py-4 text-center', {
      'border-b-orange text-orange': Number(status) === tab.status,   // Tab active
      'border-b-black/10 text-gray-900': Number(status) !== tab.status  // Tab không active
    })}
  >
    {tab.name}
  </Link>
))}
```

### Cơ chế hoạt động của Tab:

**Bấm tab "Chờ xác nhận":**

```
Link to={{ pathname: '/user/purchase', search: '?status=1' }}
    ↓
URL đổi thành /user/purchase?status=1
    ↓
HistoryPurchase re-render
    ↓
useQueryParams() = { status: '1' }
    ↓
queryKey = ['purchases', { status: '1' }] (thay đổi!)
    ↓
React Query gọi lại API: GET /purchases?status=1
    ↓
Danh sách cập nhật với đơn "Chờ xác nhận"
```

### Tại sao dùng `<Link>` thay vì `<button onClick>`?

Với `<Link>`:
- URL thay đổi → history stack được ghi → user bấm **Back** để về tab trước
- User **copy URL** `/user/purchase?status=3` chia sẻ → người nhận mở đúng tab "Đang giao"
- Bộ máy tìm kiếm có thể index từng tab theo URL riêng

Với `<button onClick` + `setState`:
- URL không đổi → Back không hoạt động đúng
- URL /user/purchase luôn giống nhau dù đang ở tab nào

### Active tab styling với `classNames`:

```typescript
{
  'border-b-orange text-orange': Number(status) === tab.status,   // Cam = đang active
  'border-b-black/10 text-gray-900': Number(status) !== tab.status  // Xám = không active
}
```

`Number(status)` vì `status` từ URL là string (`'1'`), còn `tab.status` là number (`1`).

---

## 4. UI: Hiển Thị Danh Sách Đơn Hàng

```tsx
{purchasesInPurchase?.map((purchase) => (
  <div key={purchase._id} className='mt-4 rounded-sm border-black/10 bg-white p-6 text-gray-800 shadow-sm'>
    <Link
      to={`${path.home}${generateNameId({ name: purchase.product.name, id: purchase.product._id })}`}
      className='flex'
    >
      {/* Ảnh sản phẩm */}
      <div className='shrink-0'>
        <img
          className='h-20 w-20 object-cover'
          src={purchase.product.image}
          alt={purchase.product.name}
        />
      </div>

      {/* Tên + số lượng */}
      <div className='ml-3 grow overflow-hidden'>
        <div className='truncate'>{purchase.product.name}</div>
        <div className='mt-3'>x{purchase.buy_count}</div>
      </div>

      {/* Giá */}
      <div className='ml-3 shrink-0'>
        <span className='truncate text-gray-500 line-through'>
          đ{formatCurrency(purchase.price_before_discount)}
        </span>
        <span className='ml-2 truncate text-orange'>
          đ{formatCurrency(purchase.price)}
        </span>
      </div>
    </Link>

    {/* Tổng đơn */}
    <div className='flex justify-end'>
      <div className='text-gray-500'>Thành tiền:</div>
      <div className='ml-4 text-xl text-orange'>
        đ{formatCurrency(purchase.price * purchase.buy_count)}
      </div>
    </div>
  </div>
))}
```

**`truncate`** — class Tailwind tương đương `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`. Tên sản phẩm dài sẽ bị cắt với dấu `...` thay vì xuống dòng hoặc tràn ra ngoài.

**`flex-shrink-0`** — ngăn element bị thu nhỏ trong flex container. Ảnh và giá không được phép co lại dù container nhỏ.

**`flex-grow`** — phần tên sản phẩm chiếm hết không gian còn lại. Ảnh và giá cố định, tên co giãn theo.

---

## Luồng Hoạt Động Sau Commit

```
1. User vào /user/purchase
   → status = 0 (default: tất cả)
   → Tab "Tất cả" được active (cam)
   → API: GET /purchases?status=0

2. User bấm tab "Đang giao"
   → URL: /user/purchase?status=3
   → Tab "Đang giao" active (cam)
   → queryKey đổi → API: GET /purchases?status=3
   → Hiển thị đơn hàng đang giao

3. User reload trang
   → URL: /user/purchase?status=3 (vẫn còn)
   → Tab "Đang giao" vẫn active
   → API vẫn lọc đúng status ✅

4. Dưới danh sách, tổng tiền được tính bằng useMemo
   → Không tính lại mỗi render, chỉ khi data thay đổi
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Filter bằng URL query params** | Lưu filter state vào URL thay vì useState. URL có thể share, reload vẫn giữ filter, back/forward hoạt động đúng. Pattern chuẩn cho server-side filtering. |
| **`as const`** | TypeScript operator đóng băng object thành readonly literal type. Giúp TypeScript biết giá trị cụ thể thay vì type chung chung (`-1` thay vì `number`). |
| **`queryKey` với dependencies** | Thay đổi `queryKey` trigger React Query gọi lại API. Đây là cách "subscribe" data theo parameter — mỗi combination key/params được cache độc lập. |
| **`Array.reduce()`** | Hàm functional duyệt mảng và cộng dồn một giá trị. Thường dùng để tính tổng, tối thiểu, tối đa, hoặc chuyển đổi mảng sang một giá trị khác. |
| **`useMemo` cho derived values** | Tính toán từ data (như tổng tiền) nên dùng `useMemo` thay vì tính lại mỗi render. Dependencies array xác định khi nào cần tính lại. |
| **`<Link>` cho tab** | Dùng Link (thay vì button + state) cho tab → URL thay đổi → history stack cập nhật → back/forward và share link hoạt động đúng. |
| **`createSearchParams`** | `URLSearchParams` wrapper của React Router tạo query string từ object: `{ status: '1' }` → `?status=1`. |
| **`Number(status)` type coercion** | Query params từ URL luôn là string. Khi so sánh với number constant (`purchasesStatus.all = 0`), cần parse bằng `Number()` để tránh `'0' === 0` là `false`. |
