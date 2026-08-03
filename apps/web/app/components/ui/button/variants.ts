import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-emerald-900 text-white hover:bg-emerald-800',
        outline: 'border border-emerald-900 bg-transparent text-emerald-900 hover:bg-emerald-50',
        ghost: 'text-emerald-900 hover:bg-emerald-50',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3',
        lg: 'h-12 px-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
