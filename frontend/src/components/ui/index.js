// Public API for the UI primitives. Components are grouped into subfolders
// (forms / overlays / feedback / layout / display / buttons) but consumers
// import everything from this barrel — '../../components/ui' — so the folder
// layout can change without touching call sites.

// Forms
export { default as Input } from './forms/Input'
export { default as Textarea } from './forms/Textarea'
export { default as Select } from './forms/Select'
export { default as Checkbox } from './forms/Checkbox'
export { default as Switch } from './forms/Switch'
export { default as SwitchField } from './forms/SwitchField'
export { default as Combobox } from './forms/Combobox'
export { default as MonthPicker } from './forms/MonthPicker'

// Overlays
export { default as Modal } from './overlays/Modal'
export { default as MoveToPopover } from './overlays/MoveToPopover'
export { default as FullScreenPanel } from './overlays/FullScreenPanel'

// Feedback
export { default as Alert } from './feedback/Alert'
export { default as Spinner } from './feedback/Spinner'
export { default as LoadingLogo } from './feedback/LoadingLogo'
export { default as BanterLoader } from './feedback/BanterLoader'
export { default as ProgressRing } from './feedback/ProgressRing'
export { default as CompletionRing } from './feedback/CompletionRing'
export { default as Skeleton } from './feedback/Skeleton'
export { default as LoadingPage } from './feedback/LoadingPage'
export { default as UndoToast } from './feedback/UndoToast'
export { ToastProvider } from './feedback/toast/ToastProvider'
export { useToast } from './feedback/toast/ToastContext'
export { default as BulkActionBar } from './feedback/BulkActionBar'
export { default as EmptyState } from './feedback/EmptyState'

// Layout
export { default as PageContainer } from './layout/PageContainer'
export { default as Stack } from './layout/Stack'
export { default as Panel } from './layout/Panel'
export { default as MarketingSection } from './layout/MarketingSection'

// Display
export { default as Badge } from './display/Badge'
export { default as IconBadge } from './display/IconBadge'
export { default as Divider } from './display/Divider'
export { default as StatStrip } from './display/StatStrip'
export { default as NavList } from './display/NavList'
export { default as Tabs } from './display/Tabs'
export { default as CompletionCheck } from './display/CompletionCheck'
export { default as CourseLabel } from './display/CourseLabel'
export { default as TargetLabel } from './display/TargetLabel'
export { default as RemovableItem } from './display/RemovableItem'
export { default as OptionCard } from './display/OptionCard'
export { default as SectionCard } from './display/SectionCard'
export { default as Logo } from './display/Logo'
export { default as Reveal } from './display/Reveal'
export { default as Frame } from './display/Frame'

// Buttons
export { default as Button } from './buttons/Button'
export { default as IconButton } from './buttons/IconButton'
