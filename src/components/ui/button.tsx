import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-base font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stealth-lime focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-stealth-lime to-stealth-lime-hover text-stealth-black hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-stealth-lime/25",
        secondary: "bg-gradient-to-r from-stealth-surface/80 to-stealth-card/80 backdrop-blur-xl text-stealth-white border border-stealth-border/50 hover:border-stealth-lime/30 hover:bg-gradient-to-r hover:from-stealth-card hover:to-stealth-surface shadow-md",
        destructive: "bg-gradient-to-r from-stealth-error to-red-600 text-white hover:shadow-stealth-error/25 shadow-md",
        outline: "border border-stealth-border/50 bg-transparent hover:bg-stealth-surface/50 text-stealth-white backdrop-blur-sm",
        ghost: "hover:bg-stealth-surface/30 text-stealth-white rounded-2xl",
        link: "text-stealth-lime underline-offset-4 hover:underline hover:text-stealth-lime-hover",
      },
      size: {
        default: "px-8 py-4",
        sm: "px-6 py-3 text-sm font-medium",
        lg: "px-10 py-6 text-lg font-bold",
        icon: "h-14 w-14 rounded-2xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
