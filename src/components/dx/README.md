# DX workbench kit (DevExpress-inspired)

Enterprise, data-dense UI layer used by the **clinic flow** (Patients → Visit
Initiation → HMO Desk → Triage → Consultation → Lab → Pharmacy → Billing) and
the application shell. Styles: `src/styles/dx.css` (all `.dx-*`, CSS-variable
driven, light-first with `html.dark` overrides). Import everything from
`@/components/dx`.

## Rules

1. Wrap the page in `<DxPage>` — this applies the 13px type scale (`.dx`).
2. **Never** use Tailwind colour utilities that the legacy dark-mode block in
   `globals.css` hijacks (`bg-white`, `bg-secondary-*`, `text-secondary-*`,
   `border-secondary-*`, `bg-*-50`). Use dx classes, or arbitrary values on the
   tokens: `text-[var(--dx-text-muted)]`, `bg-[var(--dx-surface-alt)]`,
   `border-[var(--dx-border)]`.
3. Flat geometry: 4px radius, 1px hairlines, no glows/blur/gradients, no
   uppercase-tracking headings. Density first: 34px grid rows, 32px controls.
4. Status → `DxStatusBadge status={...}` (auto tone) or `DxBadge tone=…`.
5. Every list is a `DxGrid` (sortable columns, `filterRow`, `DxPager`), every
   command set is a `DxToolbar`, every form is `DxForm` + `DxGroupBox`.
6. Mutations use `useToast()` for feedback and `DxConfirm` for destructive
   actions; `apiErrorMessage(err)` normalises FastAPI errors.

## Page skeleton

```tsx
<DxPage>
  <DxPageHeader crumbs={[{ label: "Queues", to: routes.queues }, { label: "Triage" }]}
    title="Triage — vital signs" subtitle="…" actions={<DxButton>…</DxButton>} />
  <VisitBanner visit={visit} />                       {/* clinic-flow context strip */}
  <DxToolbar attached>                                {/* grid toolbar */}
    <DxSearchBox onSearch={setSearch} className="w-72" />
    <DxToolbarSeparator />
    <DxSelect editorSize="sm" options={…} />
    <DxToolbarSpacer />
    <DxButton variant="primary" leftIcon={<Plus />}>New</DxButton>
  </DxToolbar>
  <DxGrid attached columns={cols} data={rows} rowKey={(r) => r.id} filterRow
    isLoading={q.isLoading} error={q.isError ? apiErrorMessage(q.error) : null}
    onRetry={q.refetch} onRowClick={open} selectedKey={selectedId}
    footer={<DxPager page={page} totalPages={…} totalItems={…} pageSize={20} onPageChange={setPage} />} />
  <div className="grid gap-4 xl:grid-cols-12">
    <DxPanel className="xl:col-span-8" title="SOAP note" icon={<FileText />} actions={…}>
      <DxForm cols={2}>
        <DxInput label="…" required error={…} />
        <DxSelect label="…" options={…} />
        <DxTextarea label="…" fieldClassName="dx-col-span-full" />
      </DxForm>
    </DxPanel>
    <DxPanel className="xl:col-span-4" title="Summary" flush>
      <DxProps items={[{ label: "Total", value: formatNaira(1700) }]} />
    </DxPanel>
  </div>
  <DxStatusBar><DxStatusItem>…</DxStatusItem></DxStatusBar>
  <DxPopup isOpen title="…" onClose={…} footer={<><DxButton>Cancel</DxButton><DxButton variant="primary">Save</DxButton></>}>…</DxPopup>
</DxPage>
```

## Components

| Need | Component |
|---|---|
| Page root / header / status bar | `DxPage`, `DxPageHeader`, `DxStatusBar`, `DxStatusItem`, `DxPageLoading` |
| Buttons | `DxButton variant="default|primary|danger|outline-danger|text|accent-text" size="sm|md|lg" icon isLoading leftIcon rightIcon` |
| Editors | `DxInput` (`unit`, `leftIcon`, `editorSize`, `mono`), `DxSelect`, `DxTextarea`, `DxCheckbox`, `DxField` (custom), `DxForm cols` |
| Containers | `DxPanel title icon description actions footer flush`, `DxGroupBox caption`, `DxProps items`, `DxMessage tone` |
| Data | `DxGrid`, `DxPager`, `DxKpi`, `DxBadge`, `DxStatusBadge` |
| Navigation | `DxTabs`, `DxSegmented`, `DxChoice` (radio-card), `DxSteps` (pathway), `DxTimeline` |
| Overlays | `DxPopup size="sm|md|lg|xl" locked`, `DxConfirm` |
| Toolbar | `DxToolbar attached`, `DxToolbarGroup`, `DxToolbarSeparator`, `DxToolbarSpacer`, `DxToolbarLabel`, `DxSearchBox` |
| Helpers | `statusTone`, `humanize`, `formatDateTime/Date/Time`, `elapsed`, `formatNaira`, `ageFrom`, `apiErrorMessage`, `stepStatusFrom` |

Clinic-flow helpers: `@/features/visits/lib/clinic-flow` (`workstationPathFor`,
`pathwaySteps`, `nextPathwayStep`, `sdpTypeLabel`, `patientDisplayName`) and
`@/features/visits/components/VisitBanner`.

Reference implementation: `src/features/clinical/pages/TriagePage.tsx`.

## Verifying changes

```bash
./node_modules/.bin/tsc -p tsconfig.json --noEmit         # what `npm run build` type-checks
./node_modules/.bin/tsc -p tsconfig.check.json --noEmit   # stricter: noUnusedLocals + verbatimModuleSyntax (many pre-existing errors elsewhere)
./node_modules/.bin/eslint src/components/dx src/features/<feature>
```
