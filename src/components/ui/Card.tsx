import * as React from 'react'
import { cn } from '../../utils/cn'

export function Card({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('rounded-lg bg-white p-4 shadow-sm', className)}>{children}</div>
}

export function CardHeader({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('mb-2', className)}>{children}</div>
}

export function CardBody({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('text-sm text-slate-700', className)}>{children}</div>
}
