# ff0088e — feat: Code UI CartLayout và custom hook useSearchProducts

## 🎯 Tổng Quan

Commit này thực hiện **3 việc chính**:

1. **Tách component (Refactoring):** Chia nhỏ `Header.tsx` (vốn rất to) thành nhiều component con có thể tái sử dụng.
2. **Tạo `CartLayout` + `CartHeader`:** Layout riêng cho trang Giỏ hàng — khác giao diện so với trang chủ (không có icon giỏ hàng, có chữ "Giỏ hàng" bên cạnh logo).
3. **Custom hook `useSearchProducts`:** Gom logic tìm kiếm sản phẩm ra hook riêng để **Header** và **CartHeader** đều dùng được mà không phải copy-paste code.

### Sơ đồ tổng thể trước và sau refactor:

```
TRƯỚC:
┌─────────────────────────────────────────────┐
│ Header.tsx (file rất to, ~260 dòng)          │
│ ├── Logic đăng nhập/đăng xuất               │
│ ├── Logic tìm kiếm sản phẩm                │
│ ├── UI ngôn ngữ, tài khoản                  │
│ ├── UI thanh tìm kiếm                       │
│ └── UI giỏ hàng popover                     │
└─────────────────────────────────────────────┘

SAU:
┌─────────────────────────────────────────────┐
│ NavHeader.tsx                                │ ← MỚI: Phần trên cùng (ngôn ngữ, tài khoản, đăng xuất)
│ useSearchProducts.tsx                        │ ← MỚI: Hook chứa logic form tìm kiếm
│                                             │
│ Header.tsx (dùng cho trang chủ/SP)           │ ← Thu gọn, import NavHeader + useSearchProducts
│ ├── <NavHeader />                            │
│ ├── useSearchProducts()                      │
│ └── UI giỏ hàng popover                     │
│                                             │
│ CartHeader.tsx (dùng cho trang giỏ hàng)     │ ← MỚI: Header riêng cho Cart
│ ├── <NavHeader />                            │
│ └── useSearchProducts()                      │
│                                             │
│ CartLayout.tsx                               │ ← MỚI: Layout cho trang Cart
│ ├── <CartHeader />                           │
│ └── <Footer />                              │
└─────────────────────────────────────────────┘
```

---

## 📁 1. `src/components/NavHeader/NavHeader.tsx` — Component Được Tách Ra

### Mục đích:
Chứa **phần trên cùng** của Header — phần mà cả `Header` lẫn `CartHeader` đều cần hiển thị:
- Nút chọn ngôn ngữ (Tiếng Việt / English)
- Avatar + Email user (nếu đã đăng nhập)
- Nút Đăng ký / Đăng nhập (nếu chưa đăng nhập)

### Code:
```tsx
export default function NavHeader() {
  const { isAuthenticated, setIsAuthenticated, setProfile, profile } = useContext(AppContext)

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setIsAuthenticated(false)
      setProfile(null)
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

### Giải thích:
- **Trước đây** logic logout và UI navbar nằm cứng trong `Header.tsx`. Khi tạo `CartHeader`, ta sẽ phải copy nguyên đoạn code này — vi phạm **DRY (Don't Repeat Yourself)**.
- **Giờ** tách ra thành `NavHeader` → cả `Header` lẫn `CartHeader` chỉ cần gọi `<NavHeader />` là xong.

---

## 📁 2. `src/hooks/useSearchProducts.tsx` — Custom Hook Tìm Kiếm

### Vấn đề:
Logic tìm kiếm sản phẩm (setup form, validate, navigate URL) **trước đây nằm trong `Header.tsx`**. Nhưng `CartHeader` cũng cần thanh tìm kiếm giống hệt → phải **gom logic** ra chỗ riêng.

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
    const config = queryConfig.order
      ? omit({ ...queryConfig, name: data.name }, ['order', 'sort_by'])
      : { ...queryConfig, name: data.name }
    navigate({
      pathname: path.home,
      search: createSearchParams(config).toString()
    })
  })

  return { onSubmitSearch, register }
}
```

### Giải thích:
- **Đây là đoạn code ĐÃ CÓ** từ `Header.tsx` ở commit trước. Không có logic mới — chỉ **di chuyển** ra custom hook.
- Hook trả về 2 thứ:
  - `register` — để gắn vào `<input>` (đăng ký input với react-hook-form)
  - `onSubmitSearch` — để gắn vào `<form onSubmit={...}>` (xử lý khi submit)
- Bất kỳ component nào cần thanh tìm kiếm, chỉ cần:
  ```tsx
  const { onSubmitSearch, register } = useSearchProducts()
  ```

### Tại sao dùng Custom Hook mà không dùng Component?
- **Component** = UI + Logic → Dùng khi cần tái sử dụng cả giao diện.
- **Custom Hook** = Chỉ Logic → Dùng khi **giao diện khác nhau** nhưng **logic giống nhau**.

Ở đây, Header có thanh search **nền trắng, nằm trong grid 12 cột**, còn CartHeader có thanh search **viền cam, nằm bên phải logo**. UI khác nhau hoàn toàn, nhưng logic (validate + navigate) giống hệt → Custom Hook là lựa chọn đúng. 

---

## 📁 3. `src/components/CartHeader/CartHeader.tsx` — Header Riêng Cho Trang Cart

### Giao diện:
```
┌──────────────────────────────────────────────────────────┐
│               Tiếng Việt ▼  |  avatar user@email.com ▼  │  ← NavHeader
├──────────────────────────────────────────────────────────┤
│  🛒 Shopee | Giỏ hàng          [🔍 Free Ship Đơn Từ 0Đ] │  ← CartHeader riêng
└──────────────────────────────────────────────────────────┘
```

So sánh với Header trang chủ:
```
┌──────────────────────────────────────────────────────────┐
│               Tiếng Việt ▼  |  avatar user@email.com ▼  │  ← NavHeader
├──────────────────────────────────────────────────────────┤
│  🛒 Shopee     [🔍 Free Ship Đơn Từ 0Đ]            🛒 5 │  ← Header chính (có icon giỏ)
└──────────────────────────────────────────────────────────┘
```

### Code:
```tsx
export default function CartHeader() {
  const { onSubmitSearch, register } = useSearchProducts()   // ← Tái sử dụng hook

  return (
    <div className='border-b border-b-black/10'>
      {/* Phần trên: NavHeader (ngôn ngữ, tài khoản) */}
      <div className='bg-orange text-white'>
        <div className='container'>
          <NavHeader />                                       {/* ← Tái sử dụng component */}
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
              <div className='bg-orange mx-4 h-8 w-px' />   {/* Đường kẻ dọc */}
              <div className='text-orange capitalize lg:text-xl'>Giỏ hàng</div>
            </Link>

            {/* Form tìm kiếm — CÙNG LOGIC, KHÁC UI */}
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

### CartHeader ≠ Header:

| Đặc điểm | Header (Trang chủ) | CartHeader (Trang giỏ) |
|-----------|-------------------|----------------------|
| **Nền** | Gradient cam-đỏ | Trắng (phần dưới) |
| **Logo** | Chỉ logo Shopee | Logo + `|` + "Giỏ hàng" |
| **Thanh search** | Nền trắng, trong grid | Viền cam, bên phải logo |
| **Icon giỏ hàng** | ✅ Có (góc phải, có badge số lượng) | ❌ Không có |
| **NavHeader** | ✅ Dùng chung | ✅ Dùng chung |
| **useSearchProducts** | ✅ Dùng chung | ✅ Dùng chung |

---

## 📁 4. `src/layouts/CartLayout/CartLayout.tsx` — Layout Mới

```tsx
import CartHeader from '~/components/CartHeader'
import Footer from '~/components/Footer'

interface Props {
  children?: React.ReactNode
}

export default function MainLayout({ children }: Props) {
  return (
    <div>
      <CartHeader />      {/* ← Dùng CartHeader thay vì Header */}
      {children}           {/* ← Nội dung trang (Cart) */}
      <Footer />           {/* ← Footer giống hệt */}
    </div>
  )
}
```

### So sánh 3 loại Layout:

| Layout | Header | Dùng cho |
|--------|--------|----------|
| `MainLayout` | `<Header />` (đầy đủ, có giỏ hàng) | Trang chủ, Chi tiết SP, Profile |
| `CartLayout` | `<CartHeader />` (đơn giản, có chữ "Giỏ hàng") | Trang Giỏ hàng |
| `RegisterLayout` | `<RegisterHeader />` (chỉ logo) | Trang Đăng nhập/Đăng ký |

---

## 📁 5. `src/useRouteElements.tsx` — Thêm Route Cho Cart

```tsx
{
  path: '',
  element: <ProtectedRoute />,
  children: [
    {
      path: path.profile,
      element: (
        <MainLayout>
          <Profile />
        </MainLayout>
      )
    },
    {
      path: path.cart,              // ← MỚI
      element: (
        <CartLayout>               // ← Dùng CartLayout thay vì MainLayout
          <Cart />
        </CartLayout>
      )
    }
  ]
}
```

- Trang Cart nằm trong `ProtectedRoute` → **phải đăng nhập** mới truy cập được.
- Dùng `CartLayout` → Header khác biệt visually so với trang chủ.

---

## 📁 6. `src/components/Header/Header.tsx` — Thu Gọn Sau Refactor

### Thay đổi chính:

```tsx
// TRƯỚC — logic logout, search, navbar đều nằm trong Header:
export default function Header() {
  const { isAuthenticated, setIsAuthenticated, setProfile, profile } = useContext(AppContext)
  const logoutMutation = useMutation({ ... })        // ~15 dòng
  const { register, handleSubmit } = useForm({ ... }) // ~10 dòng
  const onSubmitSearch = handleSubmit((data) => { ... })  // ~10 dòng
  // ... còn rất nhiều code khác

// SAU — gọn gàng:
export default function Header() {
  const { isAuthenticated } = useContext(AppContext)
  const { onSubmitSearch, register } = useSearchProducts()  // 1 dòng
  // ...
  return (
    <div>
      <NavHeader />    {/* 1 dòng thay cho ~80 dòng UI cũ */}
      {/* ... phần còn lại */}
    </div>
  )
}
```

### Thêm `enabled: isAuthenticated` cho query giỏ hàng:
```tsx
const { data: purchasesInCartData } = useQuery({
  queryKey: ['purchases', { status: purchasesStatus.inCart }],
  queryFn: () => purchaseApi.getPurchases({ status: purchasesStatus.inCart }),
  enabled: isAuthenticated    // ← MỚI THÊM
})
```

**Tại sao?** API `getPurchases` cần token xác thực. Nếu user **chưa đăng nhập** mà vẫn gọi → server trả lỗi 401. `enabled: isAuthenticated` đảm bảo chỉ gọi API khi đã đăng nhập.

---

## 🔗 Tóm Tắt Luồng Hoạt Động

```
User truy cập trang chủ → useRouteElements render <MainLayout>
    → <Header>
        → <NavHeader /> (ngôn ngữ, tài khoản)
        → useSearchProducts() (logic tìm kiếm)
        → UI giỏ hàng popover

User click "Xem giỏ hàng" → navigate đến /cart → useRouteElements render <CartLayout>
    → <CartHeader>
        → <NavHeader /> (CÙNG component trên)
        → useSearchProducts() (CÙNG logic trên)
        → UI khác: Logo | Giỏ hàng + Ô search viền cam
    → <Cart /> (nội dung giỏ hàng)
    → <Footer />
```

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Component Extraction** | Tách 1 component lớn thành nhiều component nhỏ — mỗi cái có 1 nhiệm vụ rõ ràng |
| **Custom Hook vs Component** | Hook = tái sử dụng **logic** (UI khác nhau). Component = tái sử dụng **logic + UI** (UI giống nhau) |
| **Multiple Layouts** | Mỗi nhóm trang có thể dùng Layout khác nhau — `MainLayout`, `CartLayout`, `RegisterLayout` |
| **`enabled` trong useQuery** | Chặn API chạy khi chưa đủ điều kiện (ví dụ: chưa đăng nhập → không gọi API cần auth) |
| **DRY (Don't Repeat Yourself)** | Nguyên tắc: nếu code giống nhau xuất hiện ở 2+ nơi → gom vào 1 chỗ (hook, component, util) |
