# 22fe39e — feat: Xử lý chức năng mua ngay

## 🎯 Tổng Quan

Commit này thực hiện **4 thay đổi lớn**:

1. **Chức năng "Mua ngay"** trên trang Chi tiết sản phẩm — bấm "Mua ngay" → thêm SP vào giỏ → chuyển thẳng sang trang Cart → SP đó tự động được tick chọn.
2. **Nâng `extendedPurchases` lên `AppContext`** — trước đây state này nằm local trong Cart, giờ đưa lên global context.
3. **UI giỏ hàng trống** — hiển thị ảnh + nút "Mua ngay" khi giỏ không có sản phẩm nào.
4. **Xóa `location.state`** khi rời Cart — tránh bug tự động tick sản phẩm sai khi quay lại trang Cart.

---

## Sơ đồ luồng "Mua Ngay" tổng thể:

```
Trang Chi Tiết SP                        Trang Cart
┌──────────────────┐                    ┌─────────────────────────┐
│                  │                    │                         │
│  [Thêm vào giỏ]  │                    │  ☐ Sản phẩm A           │
│  [  Mua ngay  ]  │ ── navigate ──→    │  ☑ Sản phẩm B ← TỰ TICK │
│                  │   kèm state:       │  ☐ Sản phẩm C           │
│                  │   purchaseId='b'   │                         │
└──────────────────┘                    └─────────────────────────┘
```

---

## 📁 1. `src/types/purchase.type.ts` — Di chuyển `ExtendedPurchase` ra file type

### Trước đây:
`ExtendedPurchase` được định nghĩa **bên trong `Cart.tsx`** (chỉ Cart dùng)

### Bây giờ:
```typescript
// src/types/purchase.type.ts
export interface ExtendedPurchase extends Purchase {
  disabled: boolean
  checked: boolean
}
```

**Tại sao di chuyển?** Vì giờ `AppContext` cũng cần biết type này (để khai báo state global). Đặt trong file type chung → cả `Cart.tsx` lẫn `app.context.tsx` đều import được.

---

## 📁 2. `src/contexts/app.context.tsx` — Nâng State Lên Global

### Thêm `extendedPurchases` vào AppContext:

```typescript
import type { ExtendedPurchase } from '~/types/purchase.type'

interface AppContextInterface {
  isAuthenticated: boolean
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  profile: User | null
  setProfile: React.Dispatch<React.SetStateAction<User | null>>
  extendedPurchases: ExtendedPurchase[]                                    // ← MỚI
  setExtendedPurchases: React.Dispatch<React.SetStateAction<ExtendedPurchase[]>>  // ← MỚI
}
```

Trong `AppProvider`:
```typescript
const [extendedPurchases, setExtendedPurchases] = useState<ExtendedPurchase[]>([])
```

### Tại sao phải nâng lên global ("Lifting State Up")?

**Vấn đề:** Trang `ProductDetail` bấm "Mua ngay" cần **biết và thay đổi** danh sách sản phẩm trong giỏ (để tự động tick SP vừa mua). Nhưng `extendedPurchases` trước đây nằm local bên trong `Cart.tsx` — `ProductDetail.tsx` hoàn toàn không truy cập được.

**Giải pháp:** Đưa state lên `AppContext` → bất kỳ component nào (Cart, ProductDetail, Header...) đều có thể đọc/ghi `extendedPurchases`.

```
TRƯỚC:
  ProductDetail ──(X)──→ Cart.useState (không truy cập được)

SAU:
  ProductDetail ──→ AppContext.extendedPurchases ←── Cart
                  (cả hai cùng đọc/ghi qua Context)
```

> 💡 **"Lifting State Up"** là một pattern cốt lõi trong React: khi 2 component cần chia sẻ cùng 1 state → đưa state lên component cha chung gần nhất (ở đây là AppContext bọc toàn bộ app).

---

## 📁 3. `src/pages/ProductDetail/ProductDetail.tsx` — Hàm `buyNow`

### Import mới:
```typescript
import { useNavigate, useParams } from 'react-router-dom'
import path from '~/constants/path'
```

### Hàm `buyNow`:
```typescript
const navigate = useNavigate()

const buyNow = async () => {
  const res = await addToCartMutation.mutateAsync({
    buy_count: buyCount,
    product_id: product?._id as string
  })
  const purchase = res.data.data
  navigate(path.cart, {
    state: {
      purchaseId: purchase._id
    }
  })
}
```

### Giải thích từng dòng:

#### Bước 1: `mutateAsync` thay vì `mutate`

```typescript
const res = await addToCartMutation.mutateAsync({ ... })
```

| | `mutate()` | `mutateAsync()` |
|---|---|---|
| **Trả về** | `void` (không trả gì) | `Promise` (trả kết quả API) |
| **Xử lý kết quả** | Dùng callback `onSuccess` | Dùng `await` + biến `res` |
| **Khi nào dùng** | Không cần dùng kết quả ngay | Cần dùng kết quả cho bước tiếp theo |

Ở đây ta **CẦN** lấy `purchase._id` từ kết quả API → dùng `mutateAsync` + `await`.

#### Bước 2: Lấy `purchase._id` từ response

```typescript
const purchase = res.data.data
```

Server trả về thông tin Purchase vừa tạo, bao gồm `_id` — ta cần ID này để Cart biết tick sản phẩm nào.

#### Bước 3: Navigate kèm state

```typescript
navigate(path.cart, {
  state: {
    purchaseId: purchase._id
  }
})
```

**`navigate` với `state` là gì?**

React Router cho phép truyền **dữ liệu ẩn** khi chuyển trang (không hiện trên URL):

```
URL thấy:    /cart                    ← Sạch sẽ, không có query string
Dữ liệu ẩn: { purchaseId: '123abc' } ← Chỉ code đọc được qua location.state
```

→ Trang Cart nhận diện: "À, user vừa bấm Mua ngay SP có ID `123abc` → tự tick SP đó lên!"

### Gắn vào nút "Mua ngay":
```tsx
<button
  onClick={buyNow}     // ← Gọi hàm buyNow
  className='bg-orange ...'
>
  Mua ngay
</button>
```

---

## 📁 4. `src/pages/Cart/Cart.tsx` — Nhận State & Xử Lý

### 4.1. Dùng Context thay vì local state

```typescript
// TRƯỚC:
const [extendedPurchases, setExtendedPurchases] = useState<ExtendedPurchase[]>([])

// SAU:
const { extendedPurchases, setExtendedPurchases } = useContext(AppContext)
```

### 4.2. Đọc `location.state` để biết tick SP nào

```typescript
const location = useLocation()
const choosenPurchaseIdFromLocation = (location.state as { purchaseId: string | null })?.purchaseId
```

| Biến | Giá trị | Ý nghĩa |
|------|---------|---------|
| `location.state` | `{ purchaseId: '123abc' }` hoặc `null` | Dữ liệu ẩn từ trang trước truyền sang |
| `choosenPurchaseIdFromLocation` | `'123abc'` hoặc `undefined` | ID sản phẩm cần tự động tick |

### 4.3. `useEffect` cập nhật — Tự động tick SP từ "Mua ngay"

```typescript
useEffect(() => {
  setExtendedPurchases((prev) => {
    const extendedPurchasesObject = keyBy(prev, '_id')
    return (
      purchasesInCart?.map((purchase) => {
        const isChoosenPurchaseFromLocation = choosenPurchaseIdFromLocation === purchase._id
        return {
          ...purchase,
          disabled: false,
          checked: isChoosenPurchaseFromLocation || Boolean(extendedPurchasesObject[purchase._id]?.checked)
          //        ↑ NẾU là SP từ "Mua ngay" → tick!    ↑ HOẶC giữ trạng thái tick cũ
        }
      }) || []
    )
  })
}, [purchasesInCart, choosenPurchaseIdFromLocation])
```

**Logic `checked`:**

```
checked = isChoosenPurchaseFromLocation || Boolean(extendedPurchasesObject[purchase._id]?.checked)
```

| Điều kiện | Kết quả | Ý nghĩa |
|-----------|---------|---------|
| SP khớp ID từ "Mua ngay" | `true \|\| ...` = `true` ☑ | **Tự động tick** SP vừa bấm "Mua ngay" |
| SP không khớp + đã tick trước đó | `false \|\| true` = `true` ☑ | **Giữ nguyên** trạng thái tick cũ |
| SP không khớp + chưa tick | `false \|\| false` = `false` ☐ | Không tick |

### 4.4. Xóa `location.state` khi rời Cart

```typescript
useEffect(() => {
  return () => {
    history.replaceState(null, '')
  }
})
```

**Vấn đề nếu không xóa:**
1. User bấm "Mua ngay" → Cart mở → SP B được tick ✅
2. User quay lại trang chủ
3. User vào lại Cart bằng biểu tượng giỏ hàng
4. **BUG:** `location.state` vẫn còn `{ purchaseId: 'B' }` → SP B lại bị tick tự động! ❌

**Giải pháp:** Dùng **cleanup function** trong `useEffect` (hàm `return`). Khi Cart **unmount** (rời trang) → gọi `history.replaceState(null, '')` để xóa sạch state trong history.

> 💡 **`history.replaceState(null, '')`** — API gốc của Browser (không phải của React). Thay thế entry hiện tại trong history stack bằng state `null` → xóa dữ liệu ẩn.

### 4.5. Tối ưu với `useMemo`

```typescript
// TRƯỚC (tính lại mỗi lần bất kỳ state nào thay đổi):
const isAllChecked = extendedPurchases.every(...)
const checkedPurchases = extendedPurchases.filter(...)
const totalCheckedPurchasePrice = checkedPurchases.reduce(...)

// SAU (chỉ tính lại khi dependency thay đổi):
const isAllChecked = useMemo(() => extendedPurchases.every(...), [extendedPurchases])
const checkedPurchases = useMemo(() => extendedPurchases.filter(...), [extendedPurchases])
const totalCheckedPurchasePrice = useMemo(() => checkedPurchases.reduce(...), [checkedPurchases])
const totalCheckedPurchaseSavingPrice = useMemo(() => checkedPurchases.reduce(...), [checkedPurchases])
```

Dùng `useMemo` tránh **tính toán thừa**. Ví dụ khi `extendedPurchases` không đổi nhưng component re-render vì lý do khác → các phép `.every()`, `.filter()`, `.reduce()` không cần chạy lại.

### 4.6. UI Giỏ hàng trống

```tsx
{extendedPurchases.length > 0 ? (
  <>
    {/* ... Bảng hiển thị danh sách SP ... */}
    {/* ... Footer tổng tiền ... */}
  </>
) : (
  <div className='text-center'>
    <img src={noproduct} alt='no purchase' className='mx-auto h-24 w-24' />
    <div className='mt-5 font-bold text-gray-400'>Giỏ hàng của bạn còn trống</div>
    <div className='mt-5 text-center'>
      <Link
        to={path.home}
        className='bg-orange hover:bg-orange/80 rounded-sm px-10 py-2 text-white uppercase'
      >
        Mua ngay
      </Link>
    </div>
  </div>
)}
```

Khi giỏ trống, thay vì hiện bảng trắng trơn, giờ hiện:
- 🖼️ Ảnh "no product"
- 📝 Text "Giỏ hàng của bạn còn trống"
- 🔘 Nút "Mua ngay" dẫn về trang chủ

---

## 🔗 Luồng Hoạt Động Đầy Đủ

```
1. User ở trang Chi tiết SP "Áo Thun", chọn SL = 2, bấm [Mua ngay]
       │
       ▼
2. buyNow() chạy:
   a) await addToCartMutation.mutateAsync({ product_id: 'ao-123', buy_count: 2 })
   b) Server tạo Purchase, trả về { _id: 'purchase-456', ... }
   c) navigate('/cart', { state: { purchaseId: 'purchase-456' } })
       │
       ▼
3. React Router chuyển sang /cart → CartLayout mount → Cart mount
       │
       ▼
4. Cart.tsx:
   a) useLocation() → location.state = { purchaseId: 'purchase-456' }
   b) choosenPurchaseIdFromLocation = 'purchase-456'
   c) useQuery fetch giỏ hàng → purchasesInCart = [SP_A, SP_AoThun, SP_C]
       │
       ▼
5. useEffect chạy (vì purchasesInCart thay đổi):
   Map qua từng SP:
     SP_A (id ≠ purchase-456)      → checked = false ☐
     SP_AoThun (id = purchase-456) → checked = TRUE  ☑ ← TỰ ĐỘNG TICK!
     SP_C (id ≠ purchase-456)      → checked = false ☐
       │
       ▼
6. UI render: ☐ SP_A  ☑ SP_AoThun (2 cái)  ☐ SP_C
   Tổng thanh toán: ₫xxx (chỉ tính Áo Thun)
       │
       ▼
7. User rời trang Cart → useEffect cleanup chạy:
   history.replaceState(null, '') → Xóa sạch location.state
   → Lần sau vào Cart không bị tick tự động nữa ✅
```

---

## 📁 Tóm Tắt Các File Thay Đổi

| File | Thay đổi | Mục đích |
|------|----------|----------|
| `purchase.type.ts` | Thêm `ExtendedPurchase` interface | Dùng chung cho cả Cart lẫn AppContext |
| `app.context.tsx` | Thêm `extendedPurchases` + `setExtendedPurchases` | Chia sẻ state giỏ hàng giữa các trang |
| `ProductDetail.tsx` | Thêm hàm `buyNow` + `useNavigate` | Mua ngay → thêm giỏ → chuyển Cart kèm ID |
| `Cart.tsx` | Dùng Context + `useLocation` + `useMemo` + cleanup | Nhận ID → auto tick, tối ưu performance, xóa state cũ |
| `Header.tsx` | (Nhỏ) `enabled: isAuthenticated` | Không gọi API giỏ hàng khi chưa đăng nhập |

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`mutateAsync` vs `mutate`** | `mutate` = fire-and-forget (dùng callback). `mutateAsync` = trả Promise, dùng `await` để lấy kết quả ngay |
| **`navigate(path, { state })`** | Chuyển trang kèm dữ liệu ẩn (không hiện trên URL) — đọc bằng `useLocation().state` |
| **`history.replaceState(null, '')`** | Xóa `state` khỏi history entry hiện tại — tránh bug khi quay lại trang |
| **Lifting State Up** | Đưa state từ component con lên component cha/context khi nhiều component cần chia sẻ |
| **`useMemo` cho derived state** | Cache kết quả tính toán (filter, reduce, every) — chỉ tính lại khi dependency thay đổi |
| **Cleanup function trong useEffect** | Hàm `return` bên trong `useEffect` chạy khi component **unmount** hoặc trước khi effect chạy lại |
| **Fragment `<>...</>`** | Bọc nhiều element mà không tạo thêm DOM node thừa (thay cho `<div>` wrapper) |
