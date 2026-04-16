# 6233189 — feat: Cách dùng useFormContext trong React Hook Form

## 🎯 Tổng Quan

Commit này chỉ sửa **1 file duy nhất** — `Profile.tsx` — nhưng giới thiệu một kỹ thuật quan trọng:

**Dùng `FormProvider` + `useFormContext` để chia sẻ form state giữa component cha và component con** — thay vì truyền `register`, `control`, `errors` qua props.

Có 2 thay đổi chính:

1. **Tách component `Info`** — chứa phần Tên + Số điện thoại ra khỏi form chính.
2. **Dùng `FormProvider` / `useFormContext`** — component `Info` tự lấy form methods mà không cần nhận props.

---

## 📁 File Thay Đổi

| File | Thay đổi |
|------|----------|
| `src/pages/User/pages/Profile/Profile.tsx` | Thêm `FormProvider`, tách component `Info` dùng `useFormContext` |

---

## Vấn Đề: Prop Drilling Trong Form

### Trước commit này — form nằm hết trong 1 component:

```tsx
export default function Profile() {
  const { register, control, formState: { errors }, ... } = useForm(...)

  return (
    <form>
      {/* Tên */}
      <Input register={register} name='name' errorMessage={errors.name?.message} />
      {/* Số điện thoại */}
      <Controller control={control} name='phone' render={...} />
      {/* Địa chỉ */}
      <Input register={register} name='address' errorMessage={errors.address?.message} />
      {/* ... */}
    </form>
  )
}
```

**Vấn đề:** Khi form ngày càng phức tạp (nhiều field, nhiều section), component `Profile` trở nên rất dài. Muốn tách thành component con thì phải **truyền props** xuống:

```tsx
// ❌ Prop drilling — phải truyền register, control, errors xuống từng component con
<InfoSection register={register} control={control} errors={errors} />
<AddressSection register={register} errors={errors} />
<AvatarSection register={register} errors={errors} setValue={setValue} />
```

Càng nhiều component con, càng nhiều props phải truyền → code dài, khó bảo trì.

---

## Giải Pháp: `FormProvider` + `useFormContext`

### Ý tưởng:

```
TRƯỚC (Prop Drilling):                     SAU (Context):
Profile                                     Profile
  ├── register ──→ Info (props)               ├── <FormProvider methods={...}>
  ├── control  ──→ Info (props)               │     └── <Info />
  └── errors   ──→ Info (props)               │           └── useFormContext()  ← Tự lấy!
                                               └── </FormProvider>
```

---

## 📁 Thay Đổi Chi Tiết

### Bước 1: Import thêm `FormProvider` và `useFormContext`

```diff
- import { Controller, useForm } from 'react-hook-form'
+ import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form'
```

### Bước 2: Lưu `useForm()` vào biến `methods`

```diff
  // TRƯỚC — destructure ngay
- const {
-   register,
-   control,
-   formState: { errors },
-   handleSubmit,
-   setValue,
-   watch,
-   setError
- } = useForm<FormInput, unknown, FormData>({...})

  // SAU — lưu vào methods trước, destructure sau
+ const methods = useForm<FormInput, unknown, FormData>({...})
+
+ const {
+   register,
+   control,
+   formState: { errors },
+   handleSubmit,
+   setValue,
+   watch,
+   setError
+ } = methods
```

**Tại sao lưu vào `methods`?** Vì `FormProvider` cần nhận **toàn bộ** object methods:

```tsx
<FormProvider {...methods}>
  {/* Spread tất cả methods vào context */}
</FormProvider>
```

### Bước 3: Bọc form bằng `<FormProvider>`

```diff
- <form onSubmit={onSubmit}>
-   {/* ... fields ... */}
- </form>

+ <FormProvider {...methods}>
+   <form onSubmit={onSubmit}>
+     {/* ... fields ... */}
+   </form>
+ </FormProvider>
```

### Bước 4: Tách component `Info` — dùng `useFormContext`

```tsx
function Info() {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<FormData>()        // ← Tự lấy từ context, KHÔNG cần props!

  return (
    <>
      {/* Tên */}
      <div className='mt-6 flex flex-col flex-wrap sm:flex-row'>
        <div className='truncate pt-3 capitalize sm:w-[20%] sm:text-right'>Tên</div>
        <div className='sm:w-[80%] sm:pl-5'>
          <Input
            classNameInput='w-full rounded-sm border border-gray-300 px-3 py-2 outline-none focus:border-gray-500 focus:shadow-sm'
            register={register}
            name='name'
            placeholder='Tên'
            errorMessage={errors.name?.message}
          />
        </div>
      </div>

      {/* Số điện thoại */}
      <div className='mt-2 flex flex-col flex-wrap sm:flex-row'>
        <div className='truncate pt-3 capitalize sm:w-[20%] sm:text-right'>Số điện thoại</div>
        <div className='sm:w-[80%] sm:pl-5'>
          <Controller
            control={control}
            name='phone'
            render={({ field }) => (
              <InputNumber
                classNameInput='...'
                placeholder='Số điện thoại'
                errorMessage={errors.phone?.message}
                {...field}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
    </>
  )
}
```

### Bước 5: Dùng `<Info />` trong form — KHÔNG truyền props

```tsx
<form onSubmit={onSubmit}>
  <div>Email: {profile?.email}</div>
  <Info />                                  {/* ← Không props! Tự lấy từ context */}
  <Input name='address' ... />
  <DateSelect ... />
  <Button>Lưu</Button>
</form>
```

---

## 🔗 Cách Hoạt Động Bên Trong

```
Profile (component cha)
   │
   │ 1. const methods = useForm(...)
   │ 2. <FormProvider {...methods}>        ← Đưa methods vào React Context
   │
   └── <form>
         │
         ├── <Info />                       ← Component con
         │     │
         │     │ 3. useFormContext()         ← Lấy methods từ Context
         │     │    → { register, control, errors }
         │     │
         │     ├── <Input register={register} name='name' />
         │     └── <Controller control={control} name='phone' />
         │
         ├── <Input name='address' />       ← Vẫn dùng register từ destructure
         └── <DateSelect />
```

### Tại sao `Info` có thể gọi `useFormContext()` thành công?

Vì `Info` nằm **bên trong** cây component được bọc bởi `<FormProvider>`:

```tsx
<FormProvider {...methods}>       ← Cung cấp context
  <form>
    <Info />                      ← useFormContext() lấy được ✅
  </form>
</FormProvider>
```

Nếu `Info` nằm **bên ngoài** `<FormProvider>` → `useFormContext()` sẽ trả `undefined` → crash.

---

## So Sánh 3 Cách Chia Sẻ Form State

| Cách | Code | Khi nào dùng |
|------|------|-------------|
| **1. Tất cả trong 1 component** | Không tách | Form nhỏ, ít field |
| **2. Props drilling** | `<Info register={register} errors={errors} />` | Tách 1-2 component, ít props |
| **3. FormProvider + useFormContext** | `<FormProvider>` + `useFormContext()` | Tách nhiều component, hoặc component lồng sâu |

### Khi nào NÊN dùng `useFormContext`?

```
✅ Dùng khi:
  - Form phức tạp, tách thành nhiều component/section
  - Component con cần register, control, errors mà truyền props quá dài
  - Component con lồng sâu nhiều tầng (prop drilling rất tệ)

❌ Không cần khi:
  - Form đơn giản, nằm gọn trong 1 component
  - Chỉ tách 1-2 component nhỏ, truyền 1-2 props là đủ
```

---

## 📌 Lưu Ý Quan Trọng Trong Commit Này

### Component `Info` được đặt ở đâu?

```typescript
// Nằm CÙNG FILE với Profile — không tách file riêng
function Info() { ... }           // ← Không export, chỉ dùng nội bộ

export default function Profile() { ... }
```

**Tại sao?** Đây chỉ là ví dụ minh họa cách dùng `useFormContext`. Trong thực tế, `Info` có thể tách ra file riêng (`Info.tsx`) nếu đủ phức tạp. Vì đã dùng `useFormContext`, nó vẫn lấy được form state mà không cần truyền props.

### `FormData` type cho `useFormContext`

```typescript
useFormContext<FormData>()
//             ↑ Phải truyền generic type để TypeScript biết form có những field nào
```

---

## 🔗 Sơ Đồ So Sánh Trước/Sau

```
TRƯỚC (92c7586):                             SAU (6233189):
┌─ Profile.tsx ───────────────────┐          ┌─ Profile.tsx ───────────────────┐
│                                 │          │                                 │
│ useForm() → destructure ngay    │          │ const methods = useForm()       │
│                                 │          │ destructure từ methods          │
│ <form>                          │          │                                 │
│   Email: ...                    │          │ function Info() {               │
│   Tên: <Input register=... />   │    →     │   useFormContext() ← tự lấy!   │
│   SĐT: <Controller control=../>│          │   return <Input /><Controller />│
│   Địa chỉ: <Input ... />       │          │ }                               │
│   Ngày sinh: <DateSelect />     │          │                                 │
│   [Lưu]                        │          │ <FormProvider {...methods}>      │
│ </form>                         │          │   <form>                        │
│                                 │          │     Email: ...                  │
│                                 │          │     <Info />  ← không props!   │
│                                 │          │     Địa chỉ: <Input ... />     │
│                                 │          │     [Lưu]                      │
│                                 │          │   </form>                      │
│                                 │          │ </FormProvider>                 │
└─────────────────────────────────┘          └─────────────────────────────────┘
```

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`FormProvider`** | Component của react-hook-form — bọc ngoài form, đưa tất cả form methods vào React Context |
| **`useFormContext()`** | Hook lấy form methods từ Context — component con dùng thay vì nhận qua props |
| **Prop Drilling** | Anti-pattern: truyền props qua nhiều tầng component → code dài, khó bảo trì |
| **`methods` object** | Lưu kết quả `useForm()` vào biến → cần cho cả `FormProvider` lẫn destructure nội bộ |
| **Internal component** | Component con nằm cùng file, không export — chỉ dùng nội bộ trong file đó |
| **Generic type `useFormContext<T>()`** | Truyền type cho hook để TypeScript biết form schema → autocomplete + type safety |
