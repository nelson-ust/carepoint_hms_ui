# CarePoint HMS — UI Design System

Futuristic dark-glass theme. Dark mode is the flagship; light mode fully supported.
`darkMode: "class"` on `<html>`, toggled via `useTheme()` from `@/lib/theme/ThemeProvider`.

## Principles

1. **Glass surfaces** — content sits on `.glass-card` (or `<Card>`) over the ambient
   aurora/grid page background (`.ambient-bg`, applied by `DashboardLayout`).
2. **Emerald-led accents** — primary emerald `#10B981` with cyan/violet secondary accents.
   Glows (`shadow-glow*`) are used sparingly: active nav, primary buttons, KPI icon chips.
3. **Data-dense but calm** — tables via `.table-shell` / `<DataTable>`; IDs, codes and
   amounts in `.data-mono` (JetBrains Mono); status via soft tinted pills.
4. **Dark-aware by construction** — new code must NOT rely on the legacy
   `html.dark … !important` override block in `globals.css`. Use the shared components,
   the component classes, or explicit `dark:` variants.

## Building blocks

| Need | Use |
|---|---|
| Page title row | `<PageHeader title description actions eyebrow>` |
| Breadcrumbs | `<Breadcrumbs items={[{label, to}]}>` |
| Container | `<Card>` / `<Card variant="panel">` (hover sheen) / `.glass-card` |
| Card heading | `<CardHeader title description actions>` |
| Buttons | `<Button variant="primary|secondary|ghost|danger|outline" size isLoading leftIcon>` |
| Text input | `<Input label error hint leftIcon>` (forwardRef — react-hook-form ready) |
| Select / Textarea | `<Select label options placeholder error>` / `<Textarea label error>` |
| Custom control wrapper | `<FormField label error required>` |
| Search box | `<SearchInput onSearch placeholder>` (debounced) |
| Table | `<DataTable columns data rowKey isLoading error onRetry empty onRowClick footer>` |
| Pagination | `<Pagination page totalPages|hasNext totalItems pageSize onPageChange>` |
| KPI tile | `<MetricCard label value icon tone delta isLoading>` |
| Status pill | `<Badge variant="soft-success|soft-warning|soft-danger|soft-info">` or `.pill` + tint classes |
| Empty state | `<EmptyState icon title description action>` |
| Modal | `<Modal isOpen onClose title size footer>` |
| Confirm destructive | `<ConfirmDialog isOpen onClose onConfirm title tone="danger">` |
| Toasts | `const toast = useToast(); toast.success("Saved")` (provider already mounted) |
| Loading blocks | `<Skeleton>` / `<TableSkeleton>` / `<CardSkeleton>` |
| Charts | `const chart = useChartTheme()` from `@/components/charts/chart-theme` — never hardcode hex |

Import paths: `@/components/ui/*`, `@/components/data-table/*`, `@/components/forms/*`,
`@/components/feedback/*`, `@/components/charts/*`, `@/components/layout/PageHeader`,
`@/components/navigation/Breadcrumbs`, `@/lib/utils/cn`, `@/hooks/useDebounce`, `@/hooks/useDisclosure`.

## Page recipe (list page)

```tsx
<div className="space-y-8 animate-fade-in">
  <PageHeader
    title="Radiology Orders"
    description="Track imaging requests across modalities."
    actions={<Button leftIcon={<Plus className="h-4 w-4" />}>New Order</Button>}
  />
  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard label="Pending" value={12} icon={Clock} tone="amber" />
    …
  </div>
  <Card padding="none">
    <div className="flex flex-wrap items-center gap-3 px-6 py-4">
      <SearchInput onSearch={setSearch} className="w-72" />
      <Select options={statusOptions} className="w-44 py-2.5" />
    </div>
    <DataTable columns={columns} data={rows} rowKey={(r) => r.id} isLoading={loading}
      error={error} onRetry={refetch}
      footer={<Pagination page={page} hasNext={hasNext} onPageChange={setPage} />} />
  </Card>
</div>
```

## Data layer conventions

- API functions live in `src/features/<feature>/api/<name>.api.ts`, plain async functions
  using the shared axios client `@/lib/api/api-client` (`apiClient`).
- Fetching uses `@tanstack/react-query` hooks in `src/features/<feature>/hooks/use-<name>.ts`
  (`useQuery` for reads with a stable query key; `useMutation` + `invalidateQueries` for writes).
- Mutations surface feedback through `useToast()`, destructive actions through `<ConfirmDialog>`.
- Backend base URL already includes `/api/v1`; endpoint paths must match the FastAPI routers —
  check `carepoint_hms_backend/app/api/v1/endpoints/` when adding new calls. Response shapes
  vary (`{success, message, …}` envelope or a bare resource) — normalize inside the api function.

## Do nots

- No hardcoded chart hex values — use `useChartTheme()`.
- No dynamic Tailwind class interpolation (`bg-${color}-500/10`) — map to static class strings.
- No `bg-white`/`text-secondary-900` on new surfaces without a `dark:` variant (prefer components).
- No new CSS files — extend `src/styles/globals.css` only if a primitive can't express it.
