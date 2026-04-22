# Dashboard Forms Design Guide

## Overview

This guide establishes the design system for all dashboard forms in the Eleva Care app. It's based on the refined design patterns implemented in our schedule management forms and ensures consistency, accessibility, and excellent user experience across the entire application.

## Design Philosophy

Our form design follows these core principles:

1. **Clarity**: Clear visual hierarchy and intuitive interactions
2. **Consistency**: Unified patterns across all dashboard forms
3. **Accessibility**: Proper ARIA labels, tooltips, and keyboard navigation
4. **Responsiveness**: Mobile-first design that scales beautifully
5. **Feedback**: Clear loading states, error handling, and success notifications

## Typography System

### Font Families

We use three primary font families:

- **Serif (Lora)**: For section headers and important titles
- **Sans-serif (DM Sans)**: For body text and form labels
- **Monospace (IBM Plex Mono)**: For technical data like times, codes, and values

### Typography Hierarchy

#### 1. Section Headers

```tsx
<h3 className="font-serif text-xl tracking-tight text-eleva-primary">Section Title</h3>
```

#### 2. Section Descriptions

```tsx
<p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
  Clear description of what this section does.
</p>
```

#### 3. Form Field Labels

```tsx
<div className="text-sm font-medium text-eleva-neutral-900">Field Label</div>
```

#### 4. Helper Text

```tsx
<FormDescription className="text-xs text-eleva-neutral-900/60">
  Additional context about this field
</FormDescription>
```

#### 5. Error Messages

```tsx
<FormMessage className="text-xs text-eleva-highlight-red" />
```

## Button Design System

### Button Hierarchy

Our button system follows a clear hierarchy based on action importance:

#### 1. Primary Actions (Save, Update, Submit)

- **Style**: `rounded-full` with deep teal background
- **Usage**: Main form submission, critical actions
- **Pattern**: Floating save button that appears only when form is dirty

```tsx
{
  form.formState.isDirty && (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 right-6 z-10">
      <Button
        type="submit"
        disabled={isLoading}
        className={cn(
          'px-6 py-2.5 font-medium shadow-lg transition-all',
          'bg-eleva-primary text-white hover:bg-eleva-primary/90',
          'focus:ring-2 focus:ring-eleva-primary/50 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'rounded-full',
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save changes'
        )}
      </Button>
    </div>
  );
}
```

#### 2. Secondary Actions (Add, Create)

- **Style**: `rounded-md` with sage green border
- **Usage**: Adding new items, creating resources

```tsx
<Button
  variant="outline"
  className="gap-2 rounded-md border-eleva-primary-light text-eleva-primary transition-colors hover:bg-eleva-primary-light hover:text-white"
>
  <Plus className="size-4" />
  Add Item
</Button>
```

#### 3. Tertiary Actions (Cancel, Reset)

- **Style**: `rounded` with gray border
- **Usage**: Cancel operations, reset forms

```tsx
<Button
  variant="outline"
  className="rounded border-eleva-neutral-200 text-eleva-neutral-900 transition-colors hover:bg-eleva-neutral-100"
>
  Cancel
</Button>
```

#### 4. Icon Actions (Edit, Delete)

- **Style**: `rounded-full` ghost buttons
- **Usage**: Quick actions on list items
- **Behavior**: Show only on hover with smooth transitions

```tsx
<div className="group flex items-center justify-between">
  {/* Content */}
  <div className="flex items-center gap-2">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-eleva-neutral-900/60 opacity-0 transition-opacity hover:bg-eleva-primary/10 hover:text-eleva-primary group-hover:opacity-100"
          >
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Edit item</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-eleva-neutral-900/60 opacity-0 transition-opacity hover:bg-eleva-highlight-red/10 hover:text-eleva-highlight-red group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Delete item</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</div>
```

## Layout Patterns

### Three-Column Grid Layout

Use this pattern for complex forms with multiple sections:

```tsx
<div className="space-y-8">
  <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
    <div>
      <h3 className="font-serif text-xl tracking-tight text-eleva-primary">Section Title</h3>
      <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
        Description of what this section configures.
      </p>
    </div>

    <div className="lg:col-span-2">{/* Form content */}</div>
  </div>

  <Separator className="my-8 bg-eleva-neutral-200" />

  {/* Next section */}
</div>
```

### Form Spacing Guidelines

- **Major sections**: `space-y-8`
- **Form groups**: `space-y-6`
- **Individual form items**: `space-y-2`
- **Section separators**: `my-8`

## Form Controls

### Select Dropdowns

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-eleva-neutral-900">Field Label</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6">
                <Info className="size-4 text-eleva-neutral-900/60" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Helpful explanation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <FormControl>
        <Select onValueChange={field.onChange} value={field.value}>
          <SelectTrigger className="w-[240px] border-eleva-neutral-200">
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                <span className="font-mono text-sm">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormDescription className="text-xs text-eleva-neutral-900/60">
        Additional context about this field
      </FormDescription>
      <FormMessage className="text-xs text-eleva-highlight-red" />
    </FormItem>
  )}
/>
```

### Input Fields

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem className="space-y-2">
      <FormLabel className="text-sm font-medium text-eleva-neutral-900">Field Label</FormLabel>
      <FormControl>
        <Input
          {...field}
          placeholder="Enter value"
          className="h-10 border-eleva-neutral-200 focus:border-eleva-primary focus:ring-eleva-primary/20"
        />
      </FormControl>
      <FormDescription className="text-xs text-eleva-neutral-900/60">
        Helper text for this field
      </FormDescription>
      <FormMessage className="text-xs text-eleva-highlight-red" />
    </FormItem>
  )}
/>
```

### Switch Controls

```tsx
<div className="flex items-center gap-3">
  <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
  <span className="text-sm font-medium text-eleva-neutral-900">Enable Feature</span>
</div>
```

## Interactive States

### Loading States

Always provide clear feedback during async operations:

```tsx
const [isLoading, setIsLoading] = useState(false);

// In your button
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 size-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save changes'
  )}
</Button>;
```

### Hover Effects

Use consistent hover patterns:

```tsx
// For list items
<div className="hover:bg-eleva-neutral-50 group flex items-center justify-between px-4 py-3">
  {/* Content */}
</div>

// For buttons
<Button className="transition-all duration-200 hover:bg-eleva-primary/90">
  Action
</Button>
```

### Error States

Handle errors gracefully with clear messaging:

```tsx
// Form-level errors
{
  form.formState.errors.root && (
    <div className="rounded-md bg-red-50 p-4">
      <p className="text-sm text-red-800">{form.formState.errors.root.message}</p>
    </div>
  );
}

// Field-level errors are handled by FormMessage component
```

## Color System

### Primary Colors

- `--eleva-primary` (#0D9488): Deep Teal for primary actions and selected states
- `--eleva-primary-light` (#14B8A6): Sage Green for secondary actions and borders

### Neutral Colors

- `--eleva-neutral-900`: Primary text color
- `--eleva-neutral-900/70`: Secondary text (70% opacity)
- `--eleva-neutral-900/60`: Helper text (60% opacity)
- `--eleva-neutral-200`: Borders and separators

### Accent Colors

- `--eleva-highlight-red` (#EF4444): Error states and destructive actions

## Accessibility Guidelines

### Tooltips

Always provide tooltips for icon-only buttons:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Edit className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Edit item</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Form Validation

- Use clear, actionable error messages
- Provide proper ARIA labels
- Ensure keyboard navigation works correctly
- Use semantic HTML elements

### Focus Management

```tsx
// Auto-focus important fields when appropriate
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isDialogOpen && inputRef.current) {
    inputRef.current.focus();
  }
}, [isDialogOpen]);
```

## Animation Guidelines

### Entry Animations

Use subtle animations for better UX:

```tsx
// Floating save button
<div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 right-6 z-10">
  {/* Button content */}
</div>

// Smooth transitions
<Button className="transition-all duration-200">
  Action
</Button>
```

### Micro-interactions

- Button hover states: `transition-all duration-200`
- Icon opacity changes: `opacity-0 group-hover:opacity-100`
- Form field focus states: Built into our focus classes

## Form State Management

### Unsaved Changes Protection

Protect users from losing work:

```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (form.formState.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [form.formState.isDirty]);
```

### Toast Notifications

Provide clear feedback for user actions:

```tsx
// Success notifications
toast.success('Settings saved successfully');

// Error notifications
toast.error('Failed to save settings. Please try again.');

// Loading notifications (if needed)
toast.loading('Saving settings...');
```

## Complete Form Example

Here's a complete example following all our guidelines:

```tsx
'use client';

import * as z from 'zod';
import { Button } from '@/components/atoms/button';
import { Separator } from '@/components/atoms/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/molecules/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/molecules/select';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

const formSchema = z.object({
  setting1: z.string().min(1, 'Please select an option'),
  setting2: z.string().min(1, 'Please select an option'),
});

type FormValues = z.infer<typeof formSchema>;

export function ExampleForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      setting1: '',
      setting2: '',
    },
  });

  // Unsaved changes protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.formState.isDirty]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
      form.reset(values); // Mark form as clean
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
        {/* First Section */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div>
            <h3 className="font-serif text-xl tracking-tight text-eleva-primary">
              General Settings
            </h3>
            <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
              Configure basic application settings.
            </p>
          </div>

          <div className="lg:col-span-2">
            <FormField
              control={form.control}
              name="setting1"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-eleva-neutral-900">Setting 1</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6">
                            <Info className="size-4 text-eleva-neutral-900/60" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This setting controls the first option</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1" className="cursor-pointer">
                          <span className="font-mono text-sm">Option 1</span>
                        </SelectItem>
                        <SelectItem value="option2" className="cursor-pointer">
                          <span className="font-mono text-sm">Option 2</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription className="text-xs text-eleva-neutral-900/60">
                    Choose the appropriate setting for your needs
                  </FormDescription>
                  <FormMessage className="text-xs text-eleva-highlight-red" />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator className="my-8 bg-eleva-neutral-200" />

        {/* Second Section */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
          <div>
            <h3 className="font-serif text-xl tracking-tight text-eleva-primary">
              Advanced Settings
            </h3>
            <p className="mt-1 text-sm leading-6 text-eleva-neutral-900/70">
              Configure advanced application features.
            </p>
          </div>

          <div className="lg:col-span-2">
            <FormField
              control={form.control}
              name="setting2"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-eleva-neutral-900">Setting 2</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6">
                            <Info className="size-4 text-eleva-neutral-900/60" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This setting controls the second option</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-[240px] border-eleva-neutral-200">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optionA" className="cursor-pointer">
                          <span className="font-mono text-sm">Option A</span>
                        </SelectItem>
                        <SelectItem value="optionB" className="cursor-pointer">
                          <span className="font-mono text-sm">Option B</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription className="text-xs text-eleva-neutral-900/60">
                    Select the advanced configuration option
                  </FormDescription>
                  <FormMessage className="text-xs text-eleva-highlight-red" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Floating Save Button */}
        {form.formState.isDirty && (
          <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 right-6 z-10">
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'px-6 py-2.5 font-medium shadow-lg transition-all',
                'bg-eleva-primary text-white hover:bg-eleva-primary/90',
                'focus:ring-2 focus:ring-eleva-primary/50 focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'rounded-full',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
```

## Implementation Checklist

When creating a new dashboard form, ensure you:

- [ ] Use the three-column grid layout for complex forms
- [ ] Apply proper typography hierarchy (serif headers, sans-serif labels)
- [ ] Implement the button hierarchy correctly
- [ ] Add tooltips for all icon-only buttons
- [ ] Include loading states for async operations
- [ ] Implement unsaved changes protection
- [ ] Use consistent spacing and separators
- [ ] Apply proper color classes from our design system
- [ ] Add smooth transitions and hover effects
- [ ] Include proper form validation and error handling
- [ ] Test accessibility with keyboard navigation
- [ ] Ensure mobile responsiveness

## Conclusion

Following these guidelines ensures that all dashboard forms in the Eleva Care app maintain consistency, accessibility, and excellent user experience. The design system is flexible enough to accommodate different form types while maintaining visual coherence across the application.

For questions or suggestions about these guidelines, please refer to the design team or update this documentation as the system evolves.
