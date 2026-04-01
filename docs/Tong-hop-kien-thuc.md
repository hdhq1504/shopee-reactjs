# Tổng Hợp Kiến Thức Trong Project

## 🎯 Mục Tiêu Tài Liệu

File này tổng hợp các kiến thức và kỹ thuật mà project `shopee-reactjs` đang **thực sự áp dụng** trong codebase, không chỉ là những thư viện đã cài trong `package.json`.

Mục tiêu của tài liệu:

1. Giúp Intern/Fresher nhìn ra project đang dùng những công nghệ gì.
2. Hiểu được mỗi công nghệ đang được dùng để giải quyết bài toán nào.
3. Có một “bản đồ học tập” để đọc project dễ hơn.

---

## 📦 1. Tổng Quan Stack Của Project

Project đang dùng những công nghệ chính sau:

| Nhóm | Công nghệ |
|------|-----------|
| Build tool | `Vite` |
| Ngôn ngữ | `TypeScript` |
| UI library | `React` |
| Routing | `react-router-dom` |
| Server state | `@tanstack/react-query` |
| Form | `react-hook-form` |
| Validation | `yup` + `@hookform/resolvers` |
| HTTP client | `axios` |
| Thông báo | `react-toastify` |
| CSS | `Tailwind CSS` |
| Hỗ trợ className | `classnames` |
| Utility functions | `lodash` |
| Immutable update | `immer` |
| Tooltip / popover positioning | `@floating-ui/react` |
| Animation | `framer-motion` |
| Xử lý HTML an toàn | `dompurify` |
| Code quality | `ESLint` + `Prettier` |

---

## 🧱 2. Kiến Trúc Thư Mục Của Project

Trong `src/`, project đang chia thư mục như sau:

```text
src/
├── apis
├── assets
├── components
├── constants
├── contexts
├── hooks
├── layouts
├── pages
├── types
└── utils
```

### Ý nghĩa từng thư mục

| Thư mục | Vai trò |
|--------|--------|
| `apis` | Chứa các hàm gọi API như auth, product, purchase, user |
| `assets` | Ảnh, icon, file tĩnh |
| `components` | Component dùng lại ở nhiều nơi |
| `constants` | Hằng số như route, config, status code |
| `contexts` | React Context cho state toàn app |
| `hooks` | Custom hooks |
| `layouts` | Layout dùng chung cho nhiều trang |
| `pages` | Các page chính của app |
| `types` | TypeScript types/interfaces |
| `utils` | Hàm tiện ích, auth helpers, http client |

### Đây là kiểu tổ chức gì?

Đây là kiểu tổ chức kết hợp:

1. **Layer-based**
   Ví dụ: `apis`, `utils`, `types`, `components`
2. **Feature-based ở một số module**
   Ví dụ: `pages/User/...`

Điều này giúp:

- dễ tìm file
- tách rõ trách nhiệm
- có thể mở rộng dần khi project lớn hơn

---

## ⚛️ 3. React Kiến Thức Nền Tảng Đang Dùng

Project đang dùng React theo hướng function component + hooks.

### 3.1. Function Component

Ví dụ:

```tsx
export default function Profile() {
  return <div>...</div>
}
```

Project không dùng class component.

### 3.2. JSX / TSX

Toàn bộ UI được viết bằng `TSX`, tức là:

- React component
- có JSX
- có thêm type của TypeScript

### 3.3. React StrictMode

Trong `src/main.tsx`:

```tsx
<StrictMode>
  ...
</StrictMode>
```

`StrictMode` giúp phát hiện các vấn đề tiềm ẩn trong React khi development.

### 3.4. Các Hook React đang dùng nhiều

| Hook | Dùng để làm gì trong project |
|------|------------------------------|
| `useState` | Quản lý state cục bộ trong component |
| `useEffect` | Chạy side effect như sync data, subscribe event |
| `useContext` | Lấy state global từ `AppContext` |
| `useMemo` | Tối ưu giá trị tính toán lại |
| `useRef` | Truy cập DOM hoặc lưu giá trị không cần re-render |
| `useId` | Tạo id duy nhất cho component như `Popover` |

---

## 🔁 4. React Hooks Trong Project Được Áp Dụng Như Thế Nào

### `useState`

Ví dụ trong `Profile.tsx`:

```ts
const [file, setFile] = useState<File>()
```

Dùng để lưu file ảnh mà user chọn.

### `useEffect`

Ví dụ:

```ts
useEffect(() => {
  if (profile) {
    setValue('name', profile.name)
  }
}, [profile, setValue])
```

Dùng để đổ dữ liệu từ API vào form sau khi có `profile`.

### `useContext`

Ví dụ:

```ts
const { isAuthenticated, profile, setProfile } = useContext(AppContext)
```

Giúp nhiều component cùng dùng chung auth state và profile.

### `useMemo`

Ví dụ trong `Cart.tsx`:

```ts
const checkedPurchases = useMemo(() => extendedPurchases.filter((purchase) => purchase.checked), [extendedPurchases])
```

Dùng để tránh tính toán lại không cần thiết.

### `useRef`

Ví dụ trong `Profile.tsx`:

```ts
const fileInputRef = useRef<HTMLInputElement>(null)
```

Dùng để click vào input file bị ẩn bằng code.

---

## 🌍 5. React Router DOM

Project dùng `react-router-dom` để quản lý điều hướng giữa các trang.

### 5.1. BrowserRouter

Trong `main.tsx`:

```tsx
<BrowserRouter>
  ...
</BrowserRouter>
```

Đây là router gốc của app.

### 5.2. Khai báo routes bằng `useRoutes`

Trong `useRouteElements.tsx`:

```tsx
const routeElements = useRoutes([...])
```

Project không khai route rời rạc bằng `<Routes><Route /></Routes>` trong `App.tsx`, mà gom route vào một hook riêng.

### 5.3. Route Guard

Project có 2 guard chính:

#### `ProtectedRoute`

```tsx
return isAuthenticated ? <Outlet /> : <Navigate to='/login' />
```

Ý nghĩa:

- đã đăng nhập thì vào được
- chưa đăng nhập thì bị chuyển về login

#### `RejectedRoute`

```tsx
return !isAuthenticated ? <Outlet /> : <Navigate to='/' />
```

Ý nghĩa:

- nếu đã đăng nhập rồi thì không nên vào login/register nữa

### 5.4. Nested Routes

Project áp dụng nested routes cho module User:

```text
/user/profile
/user/password
/user/purchase
```

và dùng `UserLayout` + `<Outlet />`.

### 5.5. Các Hook Router đang dùng

| Hook | Công dụng |
|------|-----------|
| `useNavigate` | Chuyển trang bằng code |
| `useLocation` | Lấy location hiện tại và `location.state` |
| `useSearchParams` | Đọc query string |
| `useRoutes` | Khai báo route tree |
| `Navigate` | Redirect |
| `Outlet` | Render route con |

### 5.6. Query Params

Project có custom hook:

- `useQueryParams`
- `useQueryConfig`

để đọc query string từ URL và biến nó thành object dùng cho filter / sort / search.

---

## 📡 6. React Query

Project dùng `@tanstack/react-query` để quản lý **server state**.

### Server state là gì?

Đó là dữ liệu đến từ backend, ví dụ:

- danh sách sản phẩm
- categories
- product detail
- profile user
- purchases trong cart

Khác với local state như:

- modal đang mở hay đóng
- file ảnh đang chọn

### 6.1. QueryClient

Trong `main.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0
    }
  }
})
```

Ý nghĩa:

- không tự refetch khi quay lại tab
- lỗi thì không tự retry

### 6.2. QueryClientProvider

```tsx
<QueryClientProvider client={queryClient}>
```

Bọc toàn app để mọi component đều dùng được React Query.

### 6.3. ReactQueryDevtools

```tsx
<ReactQueryDevtools initialIsOpen={false} />
```

Giúp debug query dễ hơn trong lúc phát triển.

### 6.4. `useQuery`

Ví dụ trong `Profile.tsx`:

```ts
const { data: profileData, refetch } = useQuery({
  queryKey: ['profile'],
  queryFn: userApi.getProfile
})
```

Ví dụ trong `Cart.tsx`:

```ts
const { data: purchasesInCartData, refetch } = useQuery({
  queryKey: ['purchases', { status: purchasesStatus.inCart }],
  queryFn: () => purchaseApi.getPurchases({ status: purchasesStatus.inCart })
})
```

### 6.5. `queryKey`

`queryKey` dùng để phân biệt từng dữ liệu cache.

Ví dụ:

- `['profile']`
- `['purchases', { status: -1 }]`

Đây là một kiến thức quan trọng của React Query.

### 6.6. `useMutation`

Dùng cho các hành động làm thay đổi dữ liệu:

- login
- register
- logout
- add to cart
- update purchase
- delete purchase
- buy products
- update profile
- upload avatar

Ví dụ:

```ts
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

### 6.7. `mutate` và `mutateAsync`

Project dùng cả 2 kiểu:

#### `mutate`

```ts
loginAccountMutation.mutate(data, {
  onSuccess: ...
})
```

Thường dùng khi xử lý nhanh với callback.

#### `mutateAsync`

```ts
const res = await updateProfileMutation.mutateAsync(...)
```

Dùng khi cần `await` để lấy kết quả ở bước tiếp theo.

### 6.8. Refetch sau mutation

Ví dụ trong `Cart.tsx`:

```ts
onSuccess: () => {
  refetch()
}
```

Project hiện đang hay dùng cách:

1. mutate xong
2. gọi `refetch()`

để đồng bộ dữ liệu mới từ server.

---

## 📝 7. React Hook Form

Project dùng `react-hook-form` để quản lý form.

### Những form chính đang dùng:

- Login
- Register
- Search product
- Filter giá
- Profile

### 7.1. `useForm`

Ví dụ:

```ts
const {
  register,
  handleSubmit,
  formState: { errors }
} = useForm<FormData>({
  resolver: yupResolver(schema)
})
```

### 7.2. `register`

Dùng cho input thường:

```tsx
<Input register={register} name='email' />
```

### 7.3. `handleSubmit`

Dùng để bọc hàm submit:

```ts
const onSubmit = handleSubmit((data) => {
  ...
})
```

### 7.4. `errors`

Dùng để hiện lỗi từng field:

```tsx
errorMessage={errors.email?.message}
```

### 7.5. `setValue`

Dùng để đổ dữ liệu bất đồng bộ từ API vào form:

```ts
setValue('name', profile.name)
```

### 7.6. `watch`

Ví dụ:

```ts
const avatar = watch('avatar')
```

Dùng để theo dõi giá trị hiện tại của field.

### 7.7. `setError` và `clearErrors`

Project dùng khi:

- backend trả lỗi validate
- file ảnh sai định dạng
- file ảnh quá dung lượng

Ví dụ:

```ts
setError('avatar', {
  message: 'Dung lượng ảnh tối đa là 1 MB',
  type: 'Manual'
})
```

### 7.8. `Controller`

Dùng khi component là custom component, không `register` trực tiếp được.

Ví dụ:

- `InputNumber`
- `DateSelect`

```tsx
<Controller
  control={control}
  name='phone'
  render={({ field }) => <InputNumber {...field} onChange={field.onChange} />}
/>
```

---

## ✅ 8. Validation Với Yup

Project dùng `yup` để define schema validate.

### 8.1. Schema chung

Trong `src/utils/rules.ts`, project có:

- `schema`
- `userSchema`

### 8.2. Dùng `.pick(...)` để tạo schema nhỏ

Ví dụ:

```ts
const loginSchema = schema.pick(['email', 'password'])
const registerSchema = schema.pick(['email', 'password', 'confirm_password'])
const profileSchema = userSchema.pick(['name', 'address', 'phone', 'date_of_birth', 'avatar'])
```

Đây là cách tái sử dụng schema rất tốt.

### 8.3. Validation custom

Ví dụ kiểm tra `price_min` và `price_max`:

```ts
function testPriceMinMax(...) { ... }
```

Đây là custom validation bằng `yup.test`.

### 8.4. `yupResolver`

Project dùng:

```ts
resolver: yupResolver(schema)
```

để nối `react-hook-form` với `yup`.

---

## 🔷 9. TypeScript Trong Project

TypeScript là một phần rất quan trọng trong project này.

### 9.1. Interface / Type

Project dùng cả:

- `interface`
- `type`

Ví dụ:

```ts
export interface User { ... }
export type PurchaseStatus = -1 | 1 | 2 | 3 | 4 | 5
```

### 9.2. Generic type

Ví dụ:

```ts
export interface SuccessResponse<Data> {
  message: string
  data: Data
}
```

Điều này giúp API response có thể tái sử dụng cho nhiều kiểu dữ liệu khác nhau.

### 9.3. Utility types của TypeScript

Project dùng khá nhiều utility types:

| Utility type | Ví dụ trong project |
|-------------|---------------------|
| `Pick<T, K>` | Chọn một số field cho form |
| `Omit<T, K>` | Bỏ một số field không cần gửi lên API |
| `NonNullable<T>` | Dùng trong `NoUndefinedField` |

Ví dụ:

```ts
type FormData = Pick<Schema, 'email' | 'password'>
interface BodyUpdateProfile extends Omit<User, '_id' | 'roles' | 'createdAt' | 'updatedAt' | 'email'> { ... }
```

### 9.4. Union types

Ví dụ:

```ts
type Role = 'User' | 'Admin'
type PurchaseStatus = -1 | 1 | 2 | 3 | 4 | 5
```

Giúp giới hạn giá trị hợp lệ rất rõ.

### 9.5. Type inference từ Yup

Project dùng:

```ts
export type Schema = yup.InferType<typeof schema>
export type UserSchema = yup.InferType<typeof userSchema>
```

Đây là cách rất hay để schema validation và TypeScript type đi cùng nhau.

### 9.6. Type narrowing với Axios error

Project có helper:

```ts
isAxiosError<T>(error)
isAxiosUnprocessableEntityError<FormError>(error)
```

Giúp TypeScript hiểu rõ kiểu của error khi bắt lỗi API.

### 9.7. Strict mode

Trong `tsconfig.app.json`:

```json
"strict": true
```

Điều này cho thấy project đang bật strict mode, tức là TypeScript kiểm tra khá chặt.

---

## 🌐 10. Axios Và HTTP Client

Project không gọi `axios` trực tiếp ở khắp nơi, mà tạo một HTTP client dùng chung trong `src/utils/http.ts`.

### 10.1. Axios instance

```ts
this.instance = axios.create({
  baseURL: config.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})
```

### 10.2. Request interceptor

Project tự động gắn access token:

```ts
config.headers.authorization = this.accessToken
```

Điều này giúp các request cần auth không phải tự set token ở từng nơi.

### 10.3. Response interceptor

Project xử lý:

- login/register thành công → lưu token + profile vào localStorage
- logout → clear localStorage
- lỗi 422 → không toast global
- lỗi khác → toast error
- 401 → clear localStorage

### 10.4. API layer riêng

Project chia API theo module:

- `auth.api.ts`
- `category.api.ts`
- `product.api.ts`
- `purchase.api.ts`
- `user.api.ts`

Đây là kiến thức rất quan trọng trong code organization.

---

## 🧠 11. State Management: Local State, Context, Server State

Project đang dùng kết hợp 3 loại state:

### 11.1. Local state

Dùng `useState` trong component.

Ví dụ:

- file ảnh đang chọn
- trạng thái mở popover

### 11.2. Global state bằng Context

Trong `AppContext`, project lưu:

- `isAuthenticated`
- `profile`
- `extendedPurchases`

Đây là dữ liệu nhiều component cần dùng chung.

### 11.3. Server state bằng React Query

Ví dụ:

- products
- categories
- purchases
- profile

### 11.4. Khi nào dùng loại nào?

| Loại state | Dùng khi |
|-----------|---------|
| Local state | Chỉ 1 component cần |
| Context | Nhiều component trong app cùng cần |
| React Query | Dữ liệu đến từ backend |

---

## 🔐 12. Auth Và Local Storage

Project đang lưu auth theo kiểu:

- `access_token` trong localStorage
- `profile` trong localStorage

### Các hàm chính trong `utils/auth.ts`

| Hàm | Vai trò |
|-----|--------|
| `setAccessTokenToLS` | Lưu access token |
| `getAccessTokenFromLS` | Đọc access token |
| `setProfileToLS` | Lưu profile |
| `getProfileFromLS` | Đọc profile |
| `clearLS` | Xóa dữ liệu auth |

### EventTarget để sync clearLS

Project có:

```ts
export const LocalStorageEventTarget = new EventTarget()
```

và trong `App.tsx`:

```ts
LocalStorageEventTarget.addEventListener('clearLS', reset)
```

Ý nghĩa:

Khi `clearLS()` chạy, app có thể reset lại context state đồng bộ.

Đây là một pattern khá hay và gọn.

---

## 🛒 13. Một Số Pattern React Quan Trọng Trong Project

### 13.1. Derived state với `useMemo`

Trong `Cart.tsx`:

- `isAllChecked`
- `checkedPurchases`
- `totalCheckedPurchasePrice`
- `totalCheckedPurchaseSavingPrice`

Đây là các giá trị được tính từ state khác.

### 13.2. Immutable update với `immer`

Ví dụ:

```ts
setExtendedPurchases(
  produce((draft) => {
    draft[purchaseIndex].checked = event.target.checked
  })
)
```

`immer` giúp update mảng/object phức tạp dễ đọc hơn.

### 13.3. Mapping state bằng `lodash/keyBy`

Ví dụ:

```ts
const extendedPurchasesObject = keyBy(prev, '_id')
```

Giúp truy cập nhanh theo id.

### 13.4. State nâng lên Context

`extendedPurchases` được đưa vào `AppContext` để:

- Cart dùng
- ProductDetail cũng có thể tương tác

Đây là pattern **lifting state up**.

---

## 🧰 14. Utility Libraries Đang Được Dùng

### 14.1. Lodash

Project dùng khá nhiều hàm của `lodash`:

- `omit`
- `omitBy`
- `isUndefined`
- `range`
- `keyBy`

### 14.2. classnames

Dùng để ghép class CSS có điều kiện.

Ví dụ:

```tsx
className={classNames('base-class', {
  active: condition
})}
```

### 14.3. react-toastify

Dùng để hiển thị thông báo:

- thành công
- thất bại
- lỗi global từ interceptor

### 14.4. dompurify

Trong `ProductDetail.tsx`, project dùng:

```ts
DOMPurify.sanitize(product.description)
```

để render HTML an toàn hơn khi dùng `dangerouslySetInnerHTML`.

Đây là kiến thức rất quan trọng về bảo mật frontend.

---

## 🎨 15. UI, CSS Và Styling

### 15.1. Tailwind CSS

Project styling chủ yếu bằng Tailwind utility classes.

Ví dụ:

```tsx
className='bg-orange flex h-9 items-center rounded-sm px-5 text-sm text-white'
```

### 15.2. Reusable UI components

Project có nhiều component dùng lại:

- `Button`
- `Input`
- `InputNumber`
- `QuantityController`
- `Pagination`
- `Popover`

Điều này giúp UI đồng nhất và giảm lặp code.

### 15.3. Layout pattern

Project có các layout riêng:

- `MainLayout`
- `RegisterLayout`
- `CartLayout`
- `UserLayout`

Đây là kiến thức tách layout khỏi page content.

---

## 🪄 16. Popover, Floating UI Và Animation

Project dùng `@floating-ui/react` trong component `Popover.tsx`.

### Các kỹ thuật đang dùng:

- `useFloating`
- `offset`
- `flip`
- `shift`
- `arrow`
- `autoUpdate`
- `useHover`
- `useFocus`
- `useDismiss`
- `useRole`
- `useInteractions`

### Mục đích

Giúp popover:

- bám đúng vị trí vào element gốc
- tự đổi hướng nếu gần mép màn hình
- có mũi tên
- tương tác hover/focus tốt hơn

### Animation

Project dùng `framer-motion`:

```tsx
<AnimatePresence>
  <motion.div ... />
</AnimatePresence>
```

để animate popover khi mở / đóng.

---

## 🔎 17. Custom Hooks Trong Project

Project có một số custom hooks đáng chú ý:

### `useQueryParams`

Đọc query string từ URL:

```ts
const [searchParams] = useSearchParams()
return Object.fromEntries([...searchParams])
```

### `useQueryConfig`

Chuẩn hóa query params thành object dùng cho API filter sản phẩm.

### `useSearchProducts`

Kết hợp:

- `react-hook-form`
- `useNavigate`
- query config

để xử lý form search sản phẩm.

### Ý nghĩa của custom hooks

Giúp:

1. tái sử dụng logic
2. giảm độ dài component
3. tách UI khỏi logic

---

## 🧭 18. Constants, Config Và Quy Ước Dùng Chung

Project có nhiều file constant:

- `path.ts`
- `purchase.ts`
- `config.ts`
- `httpStatusCode.enum.ts`

### Lợi ích

Thay vì hard-code:

- route
- API base URL
- status code
- purchase status

thì gom vào constants để:

1. dễ sửa
2. ít typo
3. code đồng nhất hơn

---

## 🧪 19. Xử Lý Lỗi Trong Project

Project có nhiều tầng xử lý lỗi:

### 19.1. Lỗi form phía client

Ví dụ:

- email sai định dạng
- password quá ngắn
- ảnh sai định dạng
- ảnh quá 1MB

### 19.2. Lỗi validate từ backend

Project bắt lỗi 422 và gán lỗi về form bằng `setError`.

### 19.3. Lỗi global từ HTTP client

Các lỗi không phải 422 sẽ được toast ở interceptor.

### 19.4. Unauthorized

Nếu gặp 401:

- clear localStorage
- auth state bị reset

---

## 🏗️ 20. Vite, Alias Và Build Tooling

### 20.1. Vite

Project dùng `Vite` làm build tool:

- chạy dev server nhanh
- build nhanh
- hỗ trợ module hiện đại tốt

### 20.2. Alias `~`

Trong `tsconfig` và `vite.config.ts`, project có:

```ts
'~' -> './src'
```

Điều này giúp import gọn hơn:

```ts
import Button from '~/components/Button'
```

thay vì:

```ts
import Button from '../../../components/Button'
```

### 20.3. Plugin React SWC

Project dùng:

```ts
@vitejs/plugin-react-swc
```

để compile React nhanh hơn.

---

## 🧹 21. ESLint, Prettier Và Code Quality

Project dùng:

- ESLint
- TypeScript ESLint
- React Hooks ESLint
- React Refresh ESLint
- Prettier

### Ý nghĩa

Giúp:

1. code ít lỗi hơn
2. format đồng nhất hơn
3. tránh các lỗi phổ biến của hooks

### Một số rule / config đáng chú ý

- `strict` TypeScript
- `noUnusedLocals`
- `noUnusedParameters`
- format theo single quote
- không dùng dấu `;`

---

## 📚 22. Những Kiến Thức React/Frontend Quan Trọng Có Thể Học Từ Project Này

Nếu học theo project này, bạn sẽ gặp và nên hiểu các chủ đề sau:

### React cơ bản

- component
- props
- state
- hooks
- conditional rendering
- list rendering

### React nâng cao hơn

- context
- custom hooks
- route guard
- nested routes
- derived state
- side effects

### Form

- controlled/uncontrolled form
- react-hook-form
- validation bằng yup
- custom component với `Controller`
- sync dữ liệu async vào form

### API

- axios instance
- request/response interceptors
- auth token
- error handling
- upload file với `FormData`

### React Query

- `useQuery`
- `useMutation`
- `queryKey`
- refetch
- cache server state

### TypeScript

- interfaces
- types
- generic response
- utility types
- infer type từ schema
- type guard

### UI / CSS

- Tailwind
- reusable components
- dynamic className
- popover
- animation

---

## 🗺️ 23. Lộ Trình Học Theo Thứ Tự Cho Intern/Fresher

Nếu đang là Intern/Fresher, nên đọc project theo thứ tự này:

### Giai đoạn 1. Nền tảng app

1. `src/main.tsx`
2. `src/App.tsx`
3. `src/useRouteElements.tsx`
4. `src/contexts/app.context.tsx`

### Giai đoạn 2. API và data layer

1. `src/utils/http.ts`
2. `src/utils/auth.ts`
3. `src/apis/*.api.ts`
4. `src/types/*.type.ts`

### Giai đoạn 3. Form và validation

1. `src/utils/rules.ts`
2. `src/pages/Login/Login.tsx`
3. `src/pages/Register/Register.tsx`
4. `src/pages/User/pages/Profile/Profile.tsx`

### Giai đoạn 4. Product list và query params

1. `src/hooks/useQueryParams.tsx`
2. `src/hooks/useQueryConfig.tsx`
3. `src/hooks/useSearchProducts.tsx`
4. `src/pages/ProductList/...`

### Giai đoạn 5. Cart và state phức tạp hơn

1. `src/pages/Cart/Cart.tsx`
2. `src/types/purchase.type.ts`
3. `AppContext` phần `extendedPurchases`

### Giai đoạn 6. UI nâng cao

1. `src/components/Popover/Popover.tsx`
2. `src/components/Pagination/Pagination.tsx`
3. `src/components/InputNumber/...`

---

## 📌 24. Kết Luận

Project này là một ví dụ khá đầy đủ của một app frontend React hiện đại ở mức junior-to-mid, vì nó đang áp dụng đồng thời nhiều kiến thức thực tế:

- React hooks
- routing
- auth
- form validation
- gọi API
- React Query
- TypeScript strict
- upload file
- state global bằng context
- Tailwind UI
- xử lý lỗi từ backend

Điểm đáng học nhất ở project này không chỉ là “code chạy được”, mà là cách các phần được tách ra:

- API tách riêng
- type tách riêng
- constants tách riêng
- routes tách riêng
- form có schema
- server state dùng React Query

Đây là những thói quen rất tốt để làm project React thực tế.
