import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-zinc-950 text-white! shadow-sm hover:-translate-y-0.5 hover:bg-zinc-800',
        outline: 'border border-zinc-200 bg-white text-zinc-950! shadow-sm hover:bg-zinc-50',
        ghost: 'text-zinc-700! hover:bg-zinc-100 hover:text-zinc-950!',
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
