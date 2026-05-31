"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [showPassword, setShowPassword] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function togglePasswordVisibility() {
    setShowPassword((value) => {
      const nextValue = !value
      if (inputRef.current) {
        inputRef.current.type = nextValue ? "text" : "password"
      }
      return nextValue
    })
  }

  return (
    <div
      className={cn(
        "flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <input
        ref={inputRef}
        type={showPassword ? "text" : "password"}
        data-slot="input"
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        {...props}
      />
      <button
        type="button"
        className="flex h-full w-10 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onMouseDown={(event) => event.preventDefault()}
        onClick={togglePasswordVisibility}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
