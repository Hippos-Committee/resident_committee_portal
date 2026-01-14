"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "~/components/ui/input"

interface EditableCellProps {
    value: string
    onSave: (newValue: string) => void
    disabled?: boolean
}

export function EditableCell({ value, onSave, disabled = false }: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue)
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave()
        } else if (e.key === "Escape") {
            setEditValue(value)
            setIsEditing(false)
        }
    }

    if (disabled) {
        return <span>{value || "-"}</span>
    }

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="h-7 py-0 px-2 text-sm min-w-[100px]"
            />
        )
    }

    return (
        <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-left hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded transition-colors cursor-text min-w-[60px] inline-block"
            title="Klikkaa muokataksesi / Click to edit"
        >
            {value || <span className="text-gray-400">-</span>}
        </button>
    )
}
