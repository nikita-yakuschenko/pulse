"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

/** Скелетон таблицы в стиле shadcn: заголовок + строки с пульсирующими ячейками */
export function TableSkeleton({
  columnCount = 6,
  rowCount = 10,
  className,
}: {
  columnCount?: number
  rowCount?: number
  className?: string
}) {
  return (
    <div className={className}>
      <Table className="[&_tbody_td]:h-10 [&_tbody_td]:py-1">
        <TableHeader className="bg-muted">
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, colIdx) => (
                <TableCell key={colIdx}>
                  <Skeleton className="h-4 w-full min-w-[60px] max-w-[180px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
