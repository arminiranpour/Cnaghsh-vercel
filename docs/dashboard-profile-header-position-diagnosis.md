# Dashboard Profile Header Position Diagnosis

## 1. Confirmed behavior

The shared `Header` is rendered once in the root app layout and is expected to scroll away with the page because it is `position: absolute`, not `fixed` or `sticky` ([`apps/web/app/layout.tsx:70`](../apps/web/app/layout.tsx), [`apps/web/components/Header.tsx:91`](../apps/web/components/Header.tsx)).

On `/dashboard/profile`, the only route-specific render path that makes the header appear stuck is the dashboard profile **edit-mode mobile pane**. In that state, the user is no longer scrolling the browser document. The user is scrolling a full-viewport inner panel that sits under the header, so the header stays visually pinned to the top while content moves beneath it.

Expected behavior: the page content should participate in normal document scrolling so the header scrolls away with the page instead of remaining visually attached to the viewport.

## 2. Header computed-position analysis

The `Header` itself remains `absolute`. Its class is still:

```tsx
absolute left-0 right-0 top-0
```

Source: [`apps/web/components/Header.tsx:91-95`](../apps/web/components/Header.tsx).

The header is rendered as a sibling of `<main>` inside the root relative wrapper:

- Root wrapper: [`apps/web/app/layout.tsx:70-83`](../apps/web/app/layout.tsx)
- Header render site: [`apps/web/app/layout.tsx:75`](../apps/web/app/layout.tsx)

I found no route-specific CSS selector overriding `header`, `[data-variant]`, `main`, `body`, or `html` for this route. `body` only gets background, color, and font smoothing in [`apps/web/app/globals.css:73-79`](../apps/web/app/globals.css). There is no route CSS module under `apps/web/app/(standalone)/dashboard/profile`, and no `document.body.style` / `document.documentElement.style` mutation in the dashboard profile tree.

Conclusion: the header remains `absolute`; it is not being overridden to `fixed`, `sticky`, `static`, or `relative`.

## 3. Scroll-container analysis

- Actual scrolling element in the affected state: the mobile edit pane `<section>` rendered by `PortfolioEditCenterPane`
- Source: [`apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx:3133-3146`](../apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx)
- Relevant class:

```tsx
fixed left-0 right-0 bottom-0 top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] z-40 w-screen overflow-x-hidden overflow-y-auto ...
```

- Body/html overflow state: default document overflow; no route-specific overflow override on `body` or `html`
- Header container: root layout wrapper at [`apps/web/app/layout.tsx:70-83`](../apps/web/app/layout.tsx)
- Header location relative to scroller: **outside** the mobile edit pane scroller

Relevant ancestor hierarchy for `/dashboard/profile`:

1. `RootLayout`
2. Root wrapper: `div.relative.flex.min-h-[100dvh].flex-col` ([`apps/web/app/layout.tsx:70-83`](../apps/web/app/layout.tsx))
3. `<Header />` ([`apps/web/app/layout.tsx:75`](../apps/web/app/layout.tsx))
4. `<main>` ([`apps/web/app/layout.tsx:76-84`](../apps/web/app/layout.tsx))
5. Dashboard route layout: `div.relative.min-h-[100svh].w-full.overflow-x-hidden` with fixed background ([`apps/web/app/(standalone)/dashboard/profile/layout.tsx:8-12`](../apps/web/app/%28standalone%29/dashboard/profile/layout.tsx))
6. `DashboardProfilePage` -> wrapper `div` ([`apps/web/app/(standalone)/dashboard/profile/page.tsx:309-324`](../apps/web/app/%28standalone%29/dashboard/profile/page.tsx))
7. `ProfilePageLayout` -> `section.relative.min-h-screen.w-full.overflow-x-hidden` ([`apps/web/components/profile/ProfilePageLayout.tsx:9-13`](../apps/web/components/profile/ProfilePageLayout.tsx))
8. `DashboardProfileClient` ([`apps/web/app/(standalone)/dashboard/profile/_components/dashboard-profile-client.tsx:71-180`](../apps/web/app/%28standalone%29/dashboard/profile/_components/dashboard-profile-client.tsx))
9. Edit branch only: `PortfolioEditCenterPane` or one of the other edit panes ([`apps/web/app/(standalone)/dashboard/profile/_components/dashboard-profile-client.tsx:122-159`](../apps/web/app/%28standalone%29/dashboard/profile/_components/dashboard-profile-client.tsx))

An inner vertical scroll container does exist on this route, but only in the dashboard edit branch on mobile. In the non-edit branch, the dashboard route uses the same `LeftRail` / `CenterPane` / `RightPane` structure as the public profile page and does not introduce a full-viewport fixed scroller.

## 4. Root cause

Confirmed root cause: **the dashboard profile mobile edit pane is implemented as a viewport-fixed, vertically scrollable container, so the user scrolls that pane instead of the document.**

- File: [`apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx`](../apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx)
- Component: `PortfolioEditCenterPane`
- Exact class/property: `fixed ... top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] ... overflow-y-auto` at [`apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx:3136-3138`](../apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx)

Why this causes the behavior:

1. The header is rendered outside this pane in the root layout.
2. The pane is `position: fixed`, so it is anchored to the viewport rather than the document.
3. The pane itself is the mobile vertical scroller because it has `overflow-y-auto`.
4. Scrolling moves the pane's content while the header stays where it already is, making the header look viewport-fixed and causing content to pass beneath it.

Breakpoint scope:

- Mobile: affected, because the base class is `fixed`
- Tablet: not affected by this cause, because `md:absolute` replaces `fixed`
- Desktop: not affected by this cause, because `md:absolute` replaces `fixed`

## 5. Supporting evidence

### Affected route hierarchy

`/dashboard/profile` renders:

1. Root layout header in [`apps/web/app/layout.tsx:75`](../apps/web/app/layout.tsx)
2. Dashboard profile route layout with fixed background in [`apps/web/app/(standalone)/dashboard/profile/layout.tsx:8-12`](../apps/web/app/%28standalone%29/dashboard/profile/layout.tsx)
3. `ProfilePageLayout` in [`apps/web/components/profile/ProfilePageLayout.tsx:9-13`](../apps/web/components/profile/ProfilePageLayout.tsx)
4. `DashboardProfileClient`
5. Either:
   - View mode: `LeftRail` + `CenterPane` + `RightPane` ([`apps/web/app/(standalone)/dashboard/profile/_components/dashboard-profile-client.tsx:163-178`](../apps/web/app/%28standalone%29/dashboard/profile/_components/dashboard-profile-client.tsx))
   - Edit mode: `EditProfileLeftRail` + edit pane + `EditProfileRightRail` ([`apps/web/app/(standalone)/dashboard/profile/_components/dashboard-profile-client.tsx:122-159`](../apps/web/app/%28standalone%29/dashboard/profile/_components/dashboard-profile-client.tsx))

### Working page comparison

Known-good public profile page `/profiles/[id]` renders:

1. The same root layout header
2. Public profile background layout with its own fixed background ([`apps/web/app/(bg-profiles)/layout.tsx:5-14`](../apps/web/app/%28bg-profiles%29/layout.tsx))
3. The same `ProfilePageLayout`
4. `ProfilePageClient`
5. `LeftRail` + `CenterPane` + `RightPane` only ([`apps/web/app/(bg-profiles)/profiles/[id]/page.tsx:85-97`](../apps/web/app/%28bg-profiles%29/profiles/%5Bid%5D/page.tsx), [`apps/web/components/profile/ProfilePageClient.tsx:55-63`](../apps/web/components/profile/ProfilePageClient.tsx))

First meaningful difference in scroll model:

- Public profile page never swaps in a full-screen fixed edit pane.
- Dashboard profile page does, via `DashboardProfileClient` edit mode.

Additional supporting duplication:

- `SubscriptionPane` uses the same mobile `fixed ... overflow-y-auto ... top-[calc(...)]` wrapper at [`apps/web/components/profile/editProfile/CenterPane/SubscriptionPane.tsx:27-35`](../apps/web/components/profile/editProfile/CenterPane/SubscriptionPane.tsx)
- The same pattern also exists in the dashboard-only edit subpanes for challenges, courses, settings, and archive.

## 6. Non-causes ruled out

- Shared `Header` component: not responsible. It remains `absolute` and is not route-overridden ([`apps/web/components/Header.tsx:91-95`](../apps/web/components/Header.tsx)).
- `ProfilePageLayout`: not responsible. It is only `relative min-h-screen w-full overflow-x-hidden` ([`apps/web/components/profile/ProfilePageLayout.tsx:9-13`](../apps/web/components/profile/ProfilePageLayout.tsx)).
- `PersonalInfoSlide`: not responsible. It contains internal `md:absolute` layout only; no fixed/sticky outer scroller ([`apps/web/components/profile/CenterPane/PersonalInfoSlide.tsx:140-199`](../apps/web/components/profile/CenterPane/PersonalInfoSlide.tsx)).
- Fixed background layer: not responsible. The working public profile layout also uses a `fixed inset-0 -z-10` background ([`apps/web/app/(standalone)/dashboard/profile/layout.tsx:9-11`](../apps/web/app/%28standalone%29/dashboard/profile/layout.tsx), [`apps/web/app/(bg-profiles)/layout.tsx:5-14`](../apps/web/app/%28bg-profiles%29/layout.tsx)).
- Internal absolute-positioned slide content: not responsible. `CenterPane` and slide internals are shared with the public profile page and do not create a viewport-fixed top-edge scroller by themselves ([`apps/web/components/profile/CenterPane/CenterPane.tsx:39-53`](../apps/web/components/profile/CenterPane/CenterPane.tsx)).

## 7. Minimal fix location

Do not change the shared `Header`.

The smallest file that should change for the confirmed bug is:

- [`apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx`](../apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx)

The smallest class/style/property likely to change is:

- the mobile wrapper class at [`apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx:3136-3138`](../apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx)
- specifically the `fixed` / `top-[calc(...)]` / `overflow-y-auto` combination that turns the pane into the viewport-level scroller

Why changing the shared `Header` would be wrong:

- the same `Header` works on other routes
- the header is not being overridden on this route
- the problem is caused by a dashboard-specific scroll container rendered below it

## 8. Confidence level

**High**

Evidence supporting this confidence:

- The header's positioning is explicit and unchanged in the shared component.
- The header is rendered outside the dashboard edit pane scroller.
- No global or route CSS overrides `header`, `body`, `html`, or `main` for this route.
- No route/client effect mutates `document.body.style` or `document.documentElement.style`.
- The first real hierarchy difference versus the working public profile page is the dashboard edit branch, which introduces the mobile `fixed` + `overflow-y-auto` pane.
- The offending class is breakpoint-scoped, which cleanly explains why the issue is mobile-only.

## Terminal summary

- Confirmed root cause: mobile dashboard edit pane scrolls inside a viewport-fixed container, not the document
- Exact file: `apps/web/components/profile/editProfile/PortfolioEditCenterPane.tsx`
- Exact offending class/property: `fixed ... top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] ... overflow-y-auto` at lines 3136-3138
- Actual scrolling element: the mobile edit-pane `<section>` rendered by `PortfolioEditCenterPane`
- Header itself needs modification: no
- Report path: `docs/dashboard-profile-header-position-diagnosis.md`
