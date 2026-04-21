# 22fe39e — feat: Xử lý chức năng Mua ngay

## Tổng Quan

Commit này thêm chức năng **Mua ngay** (Buy Now) vào trang Chi tiết sản phẩm. Khi user bấm nút này, sản phẩm được thêm vào giỏ hàng và người dùng được chuyển thẳng đến trang giỏ hàng — với đúng sản phẩm vừa mua đang được chọn sẵn.

Đây là tính năng phổ biến trên mọi sàn TMĐT (Shopee, Lazada, Tiki...).

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/ProductDetail/ProductDetail.tsx` | Sửa | Thêm hàm `handleBuyNow` |
| `src/pages/Cart/Cart.tsx` | Sửa lớn | Đọc `purchaseId` từ navigation state, tự động check sản phẩm vừa mua |
| `src/contexts/app.context.tsx` | Sửa | Thêm `extendedPurchases` state vào AppContext (Lifting State Up) |
| `src/types/purchase.type.ts` | Sửa | Thêm kiểu `ExtendedPurchase` |

---

## 1. Vấn Đề — State Ở Đâu?

### Trước commit này: `extendedPurchases` nằm trong `Cart.tsx`

```typescript
// Cart.tsx — state chỉ sống trong component này
const [extendedPurchases, setExtendedPurchases] = useState<ExtendedPurchase[]>([])
```

`ExtendedPurchase` là `Purchase` cộng thêm 2 field UI:

```typescript
interface ExtendedPurchase extends Purchase {
  disabled: boolean   // true = đang xử lý (disable checkbox/button tạm thời)
  checked: boolean    // true = đang được chọn để thanh toán
}
```

**Vấn đề khi `extendedPurchases` nằm trong `Cart`:**

Trang `ProductDetail` cần thêm sản phẩm vào giỏ rồi điều khiển `Cart` check đúng sản phẩm đó. Nhưng `ProductDetail` và `Cart` là 2 route riêng biệt — không có quan hệ cha-con. `ProductDetail` không thể gọi `setExtendedPurchases` của `Cart`.

### Giải pháp: Lifting State Up + Navigation State

Có 2 cách để `ProductDetail` "nhắn tin" cho `Cart`:

**Cách 1: Lifting State Up (đã dùng)**

Chuyển `extendedPurchases` lên `AppContext` → cả `ProductDetail` và `Cart` đều có thể truy cập.

**Cách 2: Navigation State (cũng dùng)**

Truyền thêm data theo khi navigate — `Cart` đọc data từ `location.state`.

Commit này dùng **cả 2 cách kết hợp**:
- `extendedPurchases` lên AppContext để `Cart` quản lý checked state đúng chỗ
- `purchaseId` theo navigation state để `Cart` biết cần auto-check sản phẩm nào

---

## 2. `purchase.type.ts` — Thêm `ExtendedPurchase`

```typescript
import type { Purchase } from './purchase.type'

export interface ExtendedPurchase extends Purchase {
  disabled: boolean   // Ngăn user tương tác trong khi đang gọi API
  checked: boolean    // Trạng thái checkbox trong giỏ hàng
}
```

`extends` trong TypeScript Interface: tạo type mới kế thừa tất cả field của type cha, rồi thêm field mới. Kết quả là `ExtendedPurchase` có mọi field của `Purchase` CỘNG THÊM `disabled` và `checked`.

`disabled` và `checked` là **trạng thái UI thuần túy** — server không biết cái này. Đây là lý do chúng không nằm trong `Purchase` (type ánh xạ từ server), mà phải tạo interface riêng.

---

## 3. `app.context.tsx` — Lifting State Up

### Lifting State Up là gì?

**Lifting State Up** là pattern React: khi nhiều component cần **đọc hoặc thay đổi cùng một state**, chuyển state đó lên **component cha chung gần nhất** (hoặc Context nếu component xa nhau trong cây).

```
TRƯỚC:
App
├── ProductDetail    (cần setExtendedPurchases → không thể)
└── Cart             (có extendedPurchases state)

SAU:
AppContext           ← extendedPurchases state ở đây
├── ProductDetail    (lấy từ Context → có thể!)
└── Cart             (lấy từ Context → dùng bình thường)
```

### Code:

```typescript
// src/types/purchase.type.ts
export type ExtendedPurchase = Purchase & {   // hoặc interface extends
  disabled: boolean
  checked: boolean
}

// src/contexts/app.context.tsx
interface AppContextInterface {
  // ... các field cũ ...
  extendedPurchases: ExtendedPurchase[]
  setExtendedPurchases: React.Dispatch<React.SetStateAction<ExtendedPurchase[]>>
}

const initialAppContext: AppContextInterface = {
  // ... các field cũ ...
  extendedPurchases: [],
  setExtendedPurchases: () => null
}

// Trong AppProvider:
const [extendedPurchases, setExtendedPurchases] = useState<ExtendedPurchase[]>(
  initialAppContext.extendedPurchases
)
```

---

## 4. `ProductDetail.tsx` — Hàm `handleBuyNow`

```typescript
const buyNowMutation = useMutation({
  mutationFn: purchaseApi.addToCart
})

const handleBuyNow = async () => {
  // Thêm vào giỏ hàng (API giống hàm "Thêm vào giỏ")
  const res = await buyNowMutation.mutateAsync({
    product_id: product._id,
    buy_count: buyCount
  })

  // Lấy ID của purchase vừa tạo
  const purchase = res.data.data

  // Chuyển đến giỏ hàng, kèm purchaseId trong navigation state
  navigate(path.cart, {
    state: { purchaseId: purchase._id }   // Thuộc tính state trong navigate
  })
}
```

### `navigate(path, { state })` là gì?

React Router cho phép truyền data kèm theo khi navigate — data này không xuất hiện trên URL, chỉ tồn tại trong bộ nhớ trình duyệt (History API):

```
URL sau navigate: /cart            ← Không thấy purchaseId trên URL
state:            { purchaseId: 'abc123' }  ← Ẩn, chỉ Cart.tsx đọc được
```

So sánh với query params:

| | `navigation state` | `query params` |
|---|---|---|
| Hiển thị trên URL | Không | Có |
| Tồn tại sau reload | Không | Có |
| Tồn tại sau mở tab mới | Không | Có |
| Khi nào dùng | Dữ liệu nhạy cảm / tạm thời | Dữ liệu có thể share |

`purchaseId` phù hợp với navigation state vì: chỉ cần biết một lần khi vừa navigate đến giỏ, không cần giữ lại sau reload.

---

## 5. `Cart.tsx` — Đọc `purchaseId` + Auto-Check Sản Phẩm

### Dùng `extendedPurchases` từ Context:

```typescript
// TRƯỚC — state local
const [extendedPurchases, setExtendedPurchases] = useState<ExtendedPurchase[]>([])

// SAU — từ AppContext
const { extendedPurchases, setExtendedPurchases } = useContext(AppContext)
```

### Đọc `purchaseId` từ navigation state:

```typescript
const location = useLocation()
// location.state = { purchaseId: 'abc123' } (từ ProductDetail.tsx)
//               hoặc null (nếu user vào Cart trực tiếp)

const choosenPurchaseIdFromLocation = (location.state as { purchaseId: string } | null)?.purchaseId
```

`useLocation()` hook của React Router trả về toàn bộ location object, bao gồm `state` mà `navigate()` đã truyền.

### `useEffect` sync API data + auto-check purchase:

```typescript
useEffect(() => {
  setExtendedPurchases((prev) => {
    return purchasesInCart.map((purchase) => {
      const isChoosenPurchaseFromLocation = choosenPurchaseIdFromLocation === purchase._id

      // Tìm xem purchase này có tồn tại trong prev state không
      const extendedPurchase = prev.find((item) => item._id === purchase._id)

      return {
        ...purchase,   // Merge data mới nhất từ API
        disabled: false,
        // Nếu vừa navigate đến với purchaseId: auto-check
        // Nếu đã tồn tại trong prev: giữ nguyên checked state cũ
        // Mặc định: false
        checked: isChoosenPurchaseFromLocation || Boolean(extendedPurchase?.checked)
      }
    })
  })
}, [purchasesInCart, choosenPurchaseIdFromLocation])
```

Logic này chạy khi `purchasesInCart` (data từ API) thay đổi. Nó "merge" dữ liệu server với UI state:

```
Giỏ hàng từ API: [ {_id: 'abc', product: {...}}, {_id: 'xyz', product: {...}} ]
Navigation state: { purchaseId: 'abc' }

Kết quả extendedPurchases:
[
  { _id: 'abc', ...product, disabled: false, checked: true  },  ← Auto-check (purchaseId match)
  { _id: 'xyz', ...product, disabled: false, checked: false }   ← Không check
]
```

### Cleanup `location.state` với `history.replaceState`:

```typescript
useEffect(() => {
  return () => {
    // Xóa state khi rời khỏi trang Cart
    history.replaceState(null, '')
    // → Ngăn auto-check lại khi user bấm back rồi forward
  }
}, [])
```

**Vấn đề nếu không cleanup:**

Khi user ở Cart (`state = { purchaseId: 'abc' }`), bấm về trang chủ, rồi bấm Forward lại Cart → navigation state vẫn còn → sản phẩm bị auto-check lần thứ 2 không mong muốn.

**`history.replaceState(null, '')`** — thay thế entry hiện tại trong History stack bằng state `null`, xóa sạch data mà không thêm entry mới vào history (khác với `history.pushState` thêm entry mới).

---

## 6. Các Handler Khác Trong `Cart.tsx`

### `handleCheck` — Toggle một checkbox:

```typescript
const handleCheck = (purchaseIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
  setExtendedPurchases(
    produce(extendedPurchases, (draft) => {
      draft[purchaseIndex].checked = event.target.checked
    })
  )
}
```

**`produce` từ Immer:** Thư viện giúp immutable update dễ dàng. Thay vì phải spread object để tránh mutate trực tiếp:

```typescript
// Cách thông thường (dài và phức tạp)
setExtendedPurchases(
  extendedPurchases.map((item, index) =>
    index === purchaseIndex ? { ...item, checked: event.target.checked } : item
  )
)

// Với Immer produce (ngắn gọn, dễ đọc)
setExtendedPurchases(
  produce(extendedPurchases, (draft) => {
    draft[purchaseIndex].checked = event.target.checked   // Trực tiếp mutate draft!
  })
)
```

`produce(state, recipe)` tạo bản sao sâu (deep copy) của `state`, gọi `recipe` với bản sao đó (tên là `draft`). Trong `recipe` có thể mutate `draft` thoải mái — Immer tự động tạo state mới immutable và không ảnh hưởng đến state gốc.

### `handleSelectAll` + `isAllChecked`:

```typescript
const isAllChecked = useMemo(
  () => extendedPurchases.every((purchase) => purchase.checked),
  [extendedPurchases]
)

const handleSelectAll = () => {
  setExtendedPurchases(
    produce(extendedPurchases, (draft) => {
      draft.forEach((purchase) => {
        purchase.checked = !isAllChecked   // Nếu tất cả đang checked → uncheck hết, và ngược lại
      })
    })
  )
}
```

`useMemo` tính toán `isAllChecked` chỉ khi `extendedPurchases` thay đổi — không tính lại mỗi khi render.

### `checkedPurchases` và `checkedPurchasesCount`:

```typescript
const checkedPurchases = useMemo(
  () => extendedPurchases.filter((purchase) => purchase.checked),
  [extendedPurchases]
)

const checkedPurchasesCount = checkedPurchases.length
```

`checkedPurchases` là **derived state** — không cần state riêng, chỉ cần filter từ `extendedPurchases`. Dùng `useMemo` để tránh filter lại mỗi render.

---

## Luồng Hoạt Động Đầy Đủ

```
1. User xem sản phẩm áo thun tại /product/ao-thun-dep
2. User chọn size M, số lượng 2, bấm [Mua ngay]

3. handleBuyNow():
   a) buyNowMutation.mutateAsync() → POST /purchases/add-to-cart
   b) Server tạo purchase → trả về { _id: 'purchase123', product: {...} }
   c) navigate('/cart', { state: { purchaseId: 'purchase123' } })

4. React Router render trang Cart

5. Cart.tsx:
   a) useLocation() → state = { purchaseId: 'purchase123' }
   b) choosenPurchaseIdFromLocation = 'purchase123'
   c) useQuery lấy danh sách giỏ hàng:
      [ { _id: 'purchase123', ... }, { _id: 'otherPurchase', ... } ]

6. useEffect chạy → sync API data + auto-check:
   extendedPurchases = [
     { _id: 'purchase123', checked: true  },   ← Auto-check! (purchaseId match)
     { _id: 'otherPurchase', checked: false }  ← Không check
   ]

7. UI: áo thun size M đang được checked sẵn trong giỏ hàng

8. Khi Cart unmount (user rời trang):
   history.replaceState(null, '') → xóa purchaseId khỏi history state
   → Nếu bấm back rồi forward, không còn tự động check nữa
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Lifting State Up** | Chuyển state lên component cha chung (hoặc Context) khi nhiều component cần cùng state. Giải pháp tiêu chuẩn cho vấn đề chia sẻ state giữa các component không liên quan. |
| **Navigation State** | Data truyền theo khi `navigate(path, { state })`. Không xuất hiện trên URL, không tồn tại sau reload. Dùng cho data tạm thời chỉ cần biết ngay sau navigate. |
| **`useLocation()`** | Hook của React Router để đọc URL hiện tại và navigation state. `location.state` chứa data từ `navigate(..., { state })`. |
| **`history.replaceState()`** | Web API thay đổi state của history entry hiện tại mà không thêm entry mới. Dùng để cleanup navigation state khi component unmount — ngăn stale state ảnh hưởng lần navigate sau. |
| **Immer `produce()`** | Thư viện cho phép "mutate" state trong hàm recipe — thực ra Immer tạo bản sao và không bao giờ thay đổi state gốc. Code ngắn hơn cách spread thủ công, đặc biệt khi update object lồng sâu. |
| **Derived State + `useMemo`** | Thay vì tạo state mới (`useState`) cho giá trị có thể tính từ state khác, dùng `useMemo` để tính khi cần. Giảm số lượng state, tránh state không đồng bộ. |
| **`ExtendedPurchase`** | Pattern thêm UI-only field vào data type từ server. Server không biết `checked` hay `disabled` — đây là client-side state. Tách biệt data layer và UI layer. |
