# ff0088e — feat: Code UI CartLayout và custom hook useSearchProducts

## Tổng Quan

Commit này thực hiện **3 việc chính**:

1. **Refactor Header** — Tách `Header.tsx` lớn thành nhiều component con có thể tái sử dụng.
2. **Tạo `CartLayout` + `CartHeader`** — Layout riêng cho trang Giỏ hàng, giao diện khác với trang chủ.
3. **Custom hook `useSearchProducts`** — Gom logic tìm kiếm ra hook riêng để cả `Header` và `CartHeader` đều dùng được mà không copy-paste code.

### Sơ đồ tổng thể trước và sau refactor:

```
TRƯỚC:
┌─────────────────────────────────────────────┐
│ Header.tsx (~260 dòng)                       │
│ ├── Logic đăng nhập/đăng xuất               │
│ ├── Logic tìm kiếm sản phẩm                │
│ ├── UI ngôn ngữ, tài khoản                  │
│ ├── UI thanh tìm kiếm                       │
│ └── UI giỏ hàng popover                     │
└─────────────────────────────────────────────┘

SAU:
├── NavHeader.tsx          ← Phần trên cùng (ngôn ngữ, tài khoản, đăng xuất)
├── useSearchProducts.tsx  ← Hook chứa logic form tìm kiếm
│
├── Header.tsx             ← Thu gọn, import NavHeader + useSearchProducts
│   ├── <NavHeader />
│   ├── useSearchProducts()
│   └── UI giỏ hàng popover
│
├── CartHeader.tsx         ← Header riêng cho Cart
│   ├── <NavHeader />
│   └── useSearchProducts()
│
└── CartLayout.tsx         ← Layout cho trang Cart
    ├── <CartHeader />
    └── <Footer />
```

---

## 1. `src/components/NavHeader/NavHeader.tsx` — Component Được Tách Ra

### Mục đích:

Chứa **phần trên cùng** của Header — phần mà cả `Header` lẫn `CartHeader` đều cần:
- Nút chọn ngôn ngữ
- Avatar + Email user (nếu đã đăng nhập)
- Nút Đăng ký / Đăng nhập (nếu chưa đăng nhập)

```tsx
export default function NavHeader() {
  const { isAuthenticated, setIsAuthenticated, setProfile, profile } = useContext(AppContext)

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setIsAuthenticated(false)
      setProfile(null)
      // Xóa cache giỏ hàng khỏi React Query khi đăng xuất
      queryClient.removeQueries({ queryKey: ['purchases', { status: purchasesStatus.inCart }] })
    }
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  return (
    <div className='flex justify-end'>
      <Popover ...>Tiếng Việt / English</Popover>
      {isAuthenticated && <Popover ...>Tài khoản / Đăng xuất</Popover>}
      {!isAuthenticated && <div>Đăng ký / Đăng nhập</div>}
    </div>
  )
}
```

### Tại sao cần tách ra?

**Nguyên tắc DRY (Don't Repeat Yourself):** Nếu `CartHeader` cũng cần phần navbar này, ta sẽ phải copy nguyên đoạn code vào. Khi cần sửa (thêm ngôn ngữ, thay đổi UI đăng xuất), phải sửa ở 2 nơi — dễ bỏ sót.

Tách ra thành `NavHeader` → cả `Header` và `CartHeader` chỉ cần gọi `<NavHeader />` — sửa ở một chỗ, tất cả nơi dùng đều được cập nhật.

---

## 2. `src/hooks/useSearchProducts.tsx` — Custom Hook Tìm Kiếm

### Vấn đề:

`Header.tsx` có logic tìm kiếm sản phẩm (setup form, validate, navigate URL). `CartHeader` cũng cần thanh tìm kiếm giống hệt. Nhưng UI của 2 thanh tìm kiếm khác nhau hoàn toàn:

- `Header`: Thanh tìm kiếm nền trắng, nằm trong grid 12 cột, có background orange phía sau
- `CartHeader`: Thanh tìm kiếm viền cam, nằm bên phải logo, compact hơn

**UI khác nhau nhưng logic giống nhau** → Custom Hook là giải pháp đúng.

### Custom Hook vs Component — Khi nào dùng cái nào?

| | Custom Hook | Component |
|---|---|---|
| **Chứa** | Chỉ logic | Logic + UI |
| **Trả về** | State, functions | JSX element |
| **Tái sử dụng khi** | UI khác nhau, logic giống nhau | Cả UI lẫn logic giống nhau |

### Code:

```tsx
type FormData = Pick<Schema, 'name'>
const nameSchema = schema.pick(['name'])

export default function useSearchProducts() {
  const queryConfig = useQueryConfig()

  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      name: ''
    },
    resolver: yupResolver(nameSchema)
  })
  const navigate = useNavigate()

  const onSubmitSearch = handleSubmit((data) => {
    // Nếu đang sort (có order), bỏ order khi tìm kiếm — UX tốt hơn
    const config = queryConfig.order
      ? omit({ ...queryConfig, name: data.name }, ['order', 'sort_by'])
      : { ...queryConfig, name: data.name }

    navigate({
      pathname: path.home,
      search: createSearchParams(config).toString()   // ?name=áo+thun&page=1&...
    })
  })

  return { onSubmitSearch, register }
}
```

Hook này trả về 2 thứ:
- **`register`** — gắn vào `<input>` để React Hook Form theo dõi giá trị
- **`onSubmitSearch`** — gắn vào `<form onSubmit={...}>` để xử lý khi submit

Bất kỳ component nào cần thanh tìm kiếm:

```tsx
const { onSubmitSearch, register } = useSearchProducts()
// → Xong. Không cần biết logic bên trong là gì.
```

---

## 3. `src/components/CartHeader/CartHeader.tsx` — Header Riêng Cho Trang Cart

### Giao diện so sánh:

```
Trang chủ (Header):
┌──────────────────────────────────────────────────────────┐
│           Tiếng Việt ▼  |  avatar user@email.com ▼      │ ← NavHeader
├──────────────────────────────────────────────────────────┤
│  Logo Shopee    [🔍 Free Ship Đơn Từ 0Đ]           🛒 5 │ ← Header (có icon giỏ hàng)
└──────────────────────────────────────────────────────────┘

Trang giỏ hàng (CartHeader):
┌──────────────────────────────────────────────────────────┐
│           Tiếng Việt ▼  |  avatar user@email.com ▼      │ ← NavHeader (giống hệt)
├──────────────────────────────────────────────────────────┤
│  Logo Shopee | Giỏ hàng      [🔍 Free Ship Đơn Từ 0Đ]  │ ← CartHeader (khác UI)
└──────────────────────────────────────────────────────────┘
```

```tsx
export default function CartHeader() {
  const { onSubmitSearch, register } = useSearchProducts()   // Tái sử dụng hook

  return (
    <div className='border-b border-b-black/10'>
      {/* Phần trên: NavHeader (tái sử dụng component) */}
      <div className='bg-orange text-white'>
        <div className='container'>
          <NavHeader />
        </div>
      </div>

      {/* Phần dưới: Logo + "Giỏ hàng" + Ô tìm kiếm */}
      <div className='bg-white py-6'>
        <div className='container'>
          <nav className='md:flex md:items-center md:justify-between'>
            <Link to={path.home} className='flex shrink-0 items-end'>
              <div>
                <svg viewBox='0 0 192 65' ...>Logo Shopee</svg>
              </div>
              <div className='bg-orange mx-4 h-8 w-px' />   {/* Đường kẻ dọc cam */}
              <div className='text-orange capitalize lg:text-xl'>Giỏ hàng</div>
            </Link>

            {/* Form tìm kiếm — CÙNG LOGIC (từ hook), KHÁC UI */}
            <form className='mt-3 md:mt-0 md:w-[50%]' onSubmit={onSubmitSearch}>
              <div className='border-orange flex rounded-sm border-2'>
                <input
                  type='text'
                  placeholder='Free Ship Đơn Từ 0Đ'
                  {...register('name')}
                />
                <button className='bg-orange ...'>🔍</button>
              </div>
            </form>
          </nav>
        </div>
      </div>
    </div>
  )
}
```

### So sánh các điểm khác nhau:

| Đặc điểm | Header (Trang chủ) | CartHeader (Trang giỏ) |
|-----------|-------------------|----------------------|
| Nền phần dưới | Gradient cam-đỏ | Trắng |
| Logo | Logo Shopee | Logo + `|` + "Giỏ hàng" |
| Thanh search | Nền trắng, trong grid | Viền cam, bên phải logo |
| Icon giỏ hàng | Có (badge số lượng) | Không |
| NavHeader | Dùng chung | Dùng chung |
| useSearchProducts | Dùng chung | Dùng chung |

---

## 4. `src/layouts/CartLayout/CartLayout.tsx` — Layout Mới

```tsx
import CartHeader from '~/components/CartHeader'
import Footer from '~/components/Footer'

interface Props {
  children?: React.ReactNode
}

export default function CartLayout({ children }: Props) {
  return (
    <div>
      <CartHeader />    {/* Header đặc biệt cho trang Cart */}
      {children}        {/* Nội dung trang (Cart component) */}
      <Footer />        {/* Footer giống các trang khác */}
    </div>
  )
}
```

### 3 loại Layout trong app:

| Layout | Dùng Header | Dùng cho |
|--------|------------|----------|
| `MainLayout` | `<Header />` (đầy đủ, có giỏ hàng) | Trang chủ, Chi tiết SP, Profile... |
| `CartLayout` | `<CartHeader />` (đơn giản, "Giỏ hàng") | Trang Giỏ hàng |
| `RegisterLayout` | `<RegisterHeader />` (chỉ logo) | Trang Đăng nhập/Đăng ký |

Mỗi layout phục vụ một nhóm trang có context và UX khác nhau.

---

## 5. `src/useRouteElements.tsx` — Thêm Route Cho Cart

```tsx
{
  path: '',
  element: <ProtectedRoute />,   // Yêu cầu đăng nhập
  children: [
    {
      path: path.cart,
      element: (
        <CartLayout>       {/* CartLayout thay vì MainLayout */}
          <Cart />
        </CartLayout>
      )
    }
  ]
}
```

Trang Cart nằm trong `ProtectedRoute` → phải đăng nhập mới truy cập. Dùng `CartLayout` → Header khác biệt về mặt thị giác.

---

## 6. `Header.tsx` — Thu Gọn Sau Refactor

### Trước — mọi thứ nằm trong Header:

```tsx
export default function Header() {
  const { isAuthenticated, setIsAuthenticated, setProfile, profile } = useContext(AppContext)
  const logoutMutation = useMutation({ ... })        // ~15 dòng
  const { register, handleSubmit } = useForm({ ... }) // ~10 dòng
  const onSubmitSearch = handleSubmit((data) => { ... })  // ~10 dòng
  // ... còn rất nhiều code khác (query giỏ hàng, UI navbar...)
```

### Sau — gọn gàng hơn:

```tsx
export default function Header() {
  const { isAuthenticated } = useContext(AppContext)
  const { onSubmitSearch, register } = useSearchProducts()   // 1 dòng thay ~30 dòng

  return (
    <div>
      <NavHeader />    {/* 1 component thay ~80 dòng UI */}
      {/* ... phần giỏ hàng, form tìm kiếm... */}
    </div>
  )
}
```

### Thêm `enabled: isAuthenticated` cho query giỏ hàng:

```tsx
const { data: purchasesInCartData } = useQuery({
  queryKey: ['purchases', { status: purchasesStatus.inCart }],
  queryFn: () => purchaseApi.getPurchases({ status: purchasesStatus.inCart }),
  enabled: isAuthenticated    // Chỉ gọi API khi đã đăng nhập
})
```

**Tại sao cần `enabled: isAuthenticated`?**

API `getPurchases` cần access token trong header `Authorization`. Nếu user chưa đăng nhập, không có token → server trả 401 Unauthorized → interceptor xử lý lỗi không cần thiết.

`enabled: false` ngăn React Query gọi API — không tốn request, không bị lỗi 401 giả.

---

## Tóm Tắt Luồng Hoạt Động

```
User vào trang chủ → useRouteElements render <MainLayout>
    → <Header>
        → <NavHeader /> (ngôn ngữ, tài khoản)
        → useSearchProducts() (logic tìm kiếm)
        → UI giỏ hàng popover

User click "Xem giỏ hàng" → navigate đến /cart → render <CartLayout>
    → <CartHeader>
        → <NavHeader />      (CÙNG component trên)
        → useSearchProducts() (CÙNG logic trên)
        → UI khác: Logo | Giỏ hàng + Search viền cam
    → <Cart /> (nội dung)
    → <Footer />
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Component Extraction** | Tách một component lớn thành nhiều component nhỏ, mỗi cái có một nhiệm vụ rõ ràng. Giúp code dễ đọc, dễ test, và tái sử dụng được. |
| **Custom Hook vs Component** | Custom Hook = tái sử dụng **logic** (khi UI khác nhau). Component = tái sử dụng **logic + UI** (khi UI giống nhau). Chọn đúng loại tránh copy-paste code. |
| **Multiple Layouts** | Mỗi nhóm trang có thể dùng Layout khác nhau. Khai báo Layout trong route config thay vì hardcode trong từng page component. |
| **`enabled` trong `useQuery`** | Chặn API chạy khi chưa đủ điều kiện. `enabled: false` = không gọi API. Thường dùng với auth (chưa đăng nhập) hoặc khi phụ thuộc vào data chưa có. |
| **DRY (Don't Repeat Yourself)** | Nguyên tắc: mỗi đoạn code có ý nghĩa nên chỉ xuất hiện ở **một chỗ duy nhất**. Khi cần thay đổi, chỉ sửa một nơi — giảm nguy cơ bỏ sót. |
