# 6233189 — feat: Cách dùng useFormContext trong React Hook Form

## Tổng Quan

Commit này chỉ sửa **1 file duy nhất** — `Profile.tsx` — nhưng giới thiệu kỹ thuật quan trọng:

**Dùng `FormProvider` + `useFormContext` để chia sẻ form state giữa component cha và component con** — thay vì truyền `register`, `control`, `errors` qua props từng cấp.

Có 2 thay đổi chính:
1. Tách component `Info` (phần Tên + Số điện thoại) ra khỏi form chính.
2. Dùng `FormProvider` / `useFormContext` để `Info` tự lấy form methods mà không cần nhận props.

---

## Tổng Quan File Thay Đổi

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
      <Input register={register} name='name' errorMessage={errors.name?.message} />
      <Controller control={control} name='phone' render={...} />
      <Input register={register} name='address' errorMessage={errors.address?.message} />
      {/* ... */}
    </form>
  )
}
```

Khi form ngày càng phức tạp và muốn chia nhỏ thành component con để code dễ đọc hơn, ta buộc phải **truyền props xuống**:

```tsx
// Prop drilling — phải truyền register, control, errors cho từng component con
<InfoSection register={register} control={control} errors={errors} />
<AddressSection register={register} errors={errors} />
<AvatarSection register={register} errors={errors} setValue={setValue} />
```

Vấn đề với Prop Drilling:
- Càng nhiều component con, càng nhiều props phải truyền
- Khi muốn dùng thêm một method (ví dụ `watch`), phải sửa tất cả các component trung gian
- Code dài, khó bảo trì, component con phụ thuộc chặt vào component cha

---

## Giải Pháp: `FormProvider` + `useFormContext`

### Ý tưởng

```
TRƯỚC (Prop Drilling):                         SAU (Context):
Profile                                         Profile
  ├── register ──→ Info (qua props)               ├── <FormProvider methods={...}>
  ├── control  ──→ Info (qua props)               │     └── <Info />
  └── errors   ──→ Info (qua props)               │           └── useFormContext()  ← Tự lấy!
                                                   └── </FormProvider>
```

`FormProvider` hoạt động như một React Context: bọc ngoài form và cung cấp tất cả form methods cho mọi component bên trong — không cần truyền qua props.

---

## Thay Đổi Chi Tiết

### Bước 1: Import thêm `FormProvider` và `useFormContext`

```diff
- import { Controller, useForm } from 'react-hook-form'
+ import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form'
```

### Bước 2: Lưu `useForm()` vào biến `methods` trước khi destructure

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

  // SAU — lưu toàn bộ vào methods, rồi mới destructure
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

**Tại sao cần lưu vào `methods` trước?**

`FormProvider` cần nhận **toàn bộ object** được trả về bởi `useForm()`:

```tsx
<FormProvider {...methods}>
  {/* Spread tất cả methods vào context để component con có thể truy cập */}
</FormProvider>
```

Nếu destructure ngay, ta chỉ có các biến riêng lẻ (`register`, `control`...) và không có object gốc để truyền cho `FormProvider`.

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

`FormProvider` và `<form>` là hai thứ khác nhau:
- `<FormProvider>` cung cấp form state qua React Context
- `<form>` là HTML element thật, xử lý submit event

### Bước 4: Tách component `Info` — dùng `useFormContext`

```tsx
function Info() {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<FormData>()   // Tự lấy từ context, KHÔNG cần props!

  return (
    <>
      {/* Tên */}
      <div className='mt-6 flex flex-col flex-wrap sm:flex-row'>
        <div className='truncate pt-3 capitalize sm:w-[20%] sm:text-right'>Tên</div>
        <div className='sm:w-[80%] sm:pl-5'>
          <Input
            classNameInput='w-full rounded-sm border border-gray-300 px-3 py-2 ...'
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
  <Info />                       {/* Không cần truyền props gì cả! */}
  <Input name='address' ... />
  <DateSelect ... />
  <Button>Lưu</Button>
</form>
```

---

## Cách Hoạt Động Bên Trong

```
Profile (component cha)
   │
   │ 1. const methods = useForm(...)
   │ 2. <FormProvider {...methods}>   ← Đưa methods vào React Context
   │
   └── <form>
         │
         ├── <Info />                 ← Component con
         │     │
         │     │ 3. useFormContext()  ← Lấy methods từ Context
         │     │    → { register, control, errors }
         │     │
         │     ├── <Input register={register} name='name' />
         │     └── <Controller control={control} name='phone' />
         │
         ├── <Input name='address' /> ← Vẫn dùng register từ destructure
         └── <DateSelect />
```

### Điều kiện để `useFormContext()` hoạt động

`Info` phải nằm **bên trong** cây component được bọc bởi `<FormProvider>`:

```tsx
<FormProvider {...methods}>      ← Cung cấp context
  <form>
    <Info />                     ← useFormContext() lấy được ✅
  </form>
</FormProvider>

{/* --------------- */}

<Info />                         ← Ngoài FormProvider → useFormContext() trả undefined → crash ❌
<FormProvider {...methods}>
  ...
</FormProvider>
```

---

## So Sánh 3 Cách Chia Sẻ Form State

| Cách | Cú pháp | Khi nào dùng |
|------|---------|--------------|
| **1. Tất cả trong 1 component** | Không tách | Form nhỏ, ít field, dễ đọc khi gộp lại |
| **2. Props drilling** | `<Info register={register} errors={errors} />` | Tách 1-2 component, số lượng props ít |
| **3. FormProvider + useFormContext** | `<FormProvider>` + `useFormContext()` | Form phức tạp, nhiều component con, hoặc lồng sâu nhiều tầng |

### Khi nào nên dùng `useFormContext`?

**Nên dùng khi:**
- Form phức tạp, tách thành nhiều section / component
- Component con cần `register`, `control`, `errors` nhưng truyền props quá dài
- Component con lồng sâu nhiều tầng (prop drilling qua 3+ cấp rất tệ)
- Muốn component con hoàn toàn độc lập, không phụ thuộc vào interface của cha

**Không cần khi:**
- Form đơn giản, nằm gọn trong 1 component
- Chỉ tách 1 component con nhỏ, truyền 1-2 props là đủ

---

## Lưu Ý Quan Trọng

### Component `Info` đặt ở đâu?

```typescript
// Nằm CÙNG FILE với Profile — không export, chỉ dùng nội bộ
function Info() { ... }           // Không export

export default function Profile() { ... }
```

Đây là pattern "internal component" — component con chỉ có ý nghĩa trong context của `Profile`, không nên tái sử dụng ở nơi khác. Vì vậy đặt cùng file thay vì tách ra file riêng giúp giữ mọi thứ gần nhau và dễ hiểu.

Trong thực tế nếu `Info` đủ phức tạp hoặc cần tái sử dụng → tách ra `Info.tsx` riêng. Vì đã dùng `useFormContext`, nó vẫn lấy được form state mà không cần props.

### Generic type cho `useFormContext`

```typescript
useFormContext<FormData>()
//             ↑ Truyền type để TypeScript biết form có những field nào
// → autocomplete khi truy cập errors.name, register('name')...
// → TypeScript báo lỗi nếu dùng sai tên field
```

---

## Sơ Đồ So Sánh Trước/Sau

```
TRƯỚC (92c7586):                             SAU (6233189):
┌─ Profile.tsx ───────────────────┐          ┌─ Profile.tsx ───────────────────┐
│                                 │          │                                 │
│ useForm() → destructure ngay    │          │ const methods = useForm()       │
│                                 │          │ const { register, ... } = methods│
│ <form>                          │          │                                 │
│   Email: ...                    │          │ function Info() {               │
│   Tên: <Input register=... />   │    →     │   useFormContext() ← Tự lấy!   │
│   SĐT: <Controller control=../> │          │   return <Input /><Controller/> │
│   Địa chỉ: <Input ... />        │          │ }                               │
│   Ngày sinh: <DateSelect />     │          │                                 │
│   [Lưu]                         │          │ <FormProvider {...methods}>      │
│ </form>                         │          │   <form>                        │
│                                 │          │     Email: ...                  │
│                                 │          │     <Info />  ← không props!   │
│                                 │          │     Địa chỉ: <Input ... />     │
│                                 │          │     [Lưu]                       │
│                                 │          │   </form>                       │
│                                 │          │ </FormProvider>                 │
└─────────────────────────────────┘          └─────────────────────────────────┘
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`FormProvider`** | Component của react-hook-form — bọc ngoài form, đưa tất cả form methods vào React Context. Nhận `{...methods}` từ `useForm()`. |
| **`useFormContext()`** | Hook lấy form methods từ Context — component con dùng thay vì nhận qua props. Phải gọi bên trong cây component được bọc bởi `<FormProvider>`. |
| **Prop Drilling** | Anti-pattern: truyền props qua nhiều tầng component trung gian. Khi thêm prop mới phải sửa tất cả tầng trung gian — khó bảo trì. |
| **`methods` object** | Lưu toàn bộ kết quả `useForm()` vào một biến trước khi destructure. Cần thiết để có object gốc truyền cho `FormProvider`. |
| **Internal component** | Component con khai báo trong cùng file với component cha, không export. Dùng khi component con chỉ có ý nghĩa trong context đó. |
| **Generic type `useFormContext<T>()`** | Truyền type để TypeScript biết form schema → autocomplete tên field và type safety. |
