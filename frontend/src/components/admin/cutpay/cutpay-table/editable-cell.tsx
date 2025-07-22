/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useState, useEffect, useRef } from 'react'
import { CellContext } from '@tanstack/react-table'
import { CutPayTransaction } from '@/types/cutpay.types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const EditableCell = ({
  getValue,
  row,
  column,
  table,
}: CellContext<CutPayTransaction, any>) => {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  const { updateData, editingCell, setEditingCell } = table.options.meta as any

  const isEditing = editingCell?.rowIndex === row.index && editingCell?.columnId === column.id

  const onSave = () => {
    setEditingCell(null)
    // Only trigger update if value has changed
    if (value !== initialValue) {
      updateData(row.index, column.id, value)
    }
  }

  const onCancel = () => {
    setValue(initialValue)
    setEditingCell(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue)
    }
  }, [initialValue, isEditing])

  const columnMeta = column.columnDef.meta as { type?: string; options?: { value: string; label: string }[] }
  const isNumber = columnMeta?.type === 'number'

  if (isEditing) {
    if (columnMeta?.type === 'select') {
      return (
        <div className="p-1">
          <Select value={value || ''} onValueChange={(val) => {
            setValue(val)
            updateData(row.index, column.id, val)
            setEditingCell(null)
          }}>
            <SelectTrigger
              className="h-9 w-full focus:ring-2 focus:ring-blue-400 transition-transform duration-200 scale-105 bg-white"
              onBlur={() => setEditingCell(null)}
            >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {columnMeta.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    return (
      <div className="p-1">
        <Input
          ref={inputRef}
          type={columnMeta?.type || 'text'}
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 w-full bg-white ring-2 ring-blue-400 transition-transform duration-200 scale-105",
            isNumber && "text-right"
          )}
        />
      </div>
    )
  }

  return (
    <div
      onDoubleClick={() => setEditingCell({ rowIndex: row.index, columnId: column.id })}
      className={cn(
        "w-full h-full min-h-[53px] flex items-center px-4 py-2",
        "hover:bg-blue-100/50 cursor-pointer",
        isNumber ? 'justify-end' : 'justify-start'
      )}
    >
      {value ?? <span className="text-gray-400">N/A</span>}
    </div>
  )
}