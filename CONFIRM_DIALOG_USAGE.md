# Using the ConfirmDialog Component

The project now has a reusable `ConfirmDialog` component that replaces the native browser `confirm()` dialogs with a properly styled modal.

## Quick Start

### 1. Import the hook and component

```tsx
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
```

### 2. Use the hook in your component

```tsx
export const MyComponent = () => {
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (confirmed) {
      // Proceed with deletion
      await deleteItem();
    }
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>
      
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        variant={options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
```

## Variants

- `danger` - Red theme for destructive actions
- `warning` - Yellow theme for caution (default)
- `info` - Blue theme for informational confirmations

## Migration from window.confirm()

### Before:
```tsx
const handleDelete = () => {
  if (confirm("Delete this item?")) {
    deleteItem();
  }
};
```

### After:
```tsx
const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: 'Confirm Deletion',
    message: 'Delete this item?',
    variant: 'danger'
  });

  if (confirmed) {
    deleteItem();
  }
};

// Don't forget to add the dialog component to your JSX:
<ConfirmDialog
  isOpen={isOpen}
  title={options.title}
  message={options.message}
  confirmLabel={options.confirmLabel}
  cancelLabel={options.cancelLabel}
  variant={options.variant}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
```

## Features

- ✅ Promise-based API (works with async/await)
- ✅ Customizable titles, messages, and button labels
- ✅ Three visual variants (danger, warning, info)
- ✅ Smooth animations
- ✅ Backdrop blur effect
- ✅ Responsive design
- ✅ Accessible keyboard navigation

## Example: CustomerProfile.tsx

See `/components/customer/CustomerProfile.tsx` lines 105 and 153 for examples of where `confirm()` is currently used and should be migrated.
