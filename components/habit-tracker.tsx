"use client"

import { useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Download, Upload, Trash2, Settings, Save, Plus, X, Pencil, LayoutList, LayoutGrid, GripVertical, FileText, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DayStatus {
  date: string
  completed: boolean
}

interface Habit {
  id: string
  name: string
  dateCreated: string
  dateStopped?: string
  days: DayStatus[]
}

interface HabitData {
  habits: Habit[]
  completedColor?: string
  showStreak?: {[key: string]: boolean}
  viewMode?: 'list' | 'grid'
}

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [newHabitName, setNewHabitName] = useState("")
  const [dateStoppedInput, setDateStoppedInput] = useState<Date | null>(null)
  const [showStreak, setShowStreak] = useState<{[key: string]: boolean}>({})
  const [completedColor, setCompletedColor] = useState("#18181b") // zinc-900
  const [showSettings, setShowSettings] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showNewHabitForm, setShowNewHabitForm] = useState(false)
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitName, setEditingHabitName] = useState("")
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [reorderMode, setReorderMode] = useState(false)
  const [checkInMode, setCheckInMode] = useState(false)
  const [checkInSelections, setCheckInSelections] = useState<{[key: string]: boolean | null}>({})
  const [checkInHasInteracted, setCheckInHasInteracted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load data from OPFS on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const root = await navigator.storage.getDirectory()
        const fileHandle = await root.getFileHandle('habit-tracker-data.json', { create: false })
        const file = await fileHandle.getFile()
        const text = await file.text()
        const data = JSON.parse(text) as HabitData

        setHabits(data.habits || [])
        setCompletedColor(data.completedColor || "#18181b")
        setShowStreak(data.showStreak || {})
        setViewMode(data.viewMode || 'list')

        console.log('Loaded data from persistent storage')
      } catch (error) {
        console.log('No persistent data found, starting fresh')
      }
    }

    loadData()
  }, [])

  // Auto-save to OPFS when data changes (debounced)
  useEffect(() => {
    if (habits.length === 0) return

    const saveData = async () => {
      try {
        const root = await navigator.storage.getDirectory()
        const fileHandle = await root.getFileHandle('habit-tracker-data.json', { create: true })
        const writable = await fileHandle.createWritable()

        const data: HabitData = {
          habits,
          completedColor,
          showStreak,
          viewMode
        }

        await writable.write(JSON.stringify(data, null, 2))
        await writable.close()
        setLastSaved(new Date())
      } catch (error) {
        console.error('Error auto-saving:', error)
      }
    }

    // Debounce: wait 1 second after last change before saving
    const timer = setTimeout(saveData, 1000)
    return () => clearTimeout(timer)
  }, [habits, completedColor, showStreak, viewMode])

  // Generate dates for a full calendar year (Jan 1 - Dec 31)
  const generateDates = (habitStartDate: string, habitEndDate?: string) => {
    const dates: DayStatus[] = []
    const seenDates = new Set<string>()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Start from January 1st of current year
    const currentYear = today.getFullYear()
    const jan1 = new Date(currentYear, 0, 1)
    jan1.setHours(0, 0, 0, 0)

    // End at December 31st of current year
    const dec31 = new Date(currentYear, 11, 31)
    dec31.setHours(0, 0, 0, 0)

    // Find the most recent Sunday before or on Jan 1 (GitHub starts weeks on Sunday)
    const dayOfWeek = jan1.getDay()
    const startDate_calc = new Date(jan1)
    startDate_calc.setDate(jan1.getDate() - dayOfWeek)

    // Parse the end date if provided
    let rangeStart: Date | null = null
    let rangeEnd: Date | null = null

    if (habitEndDate) {
      const stoppedDate = new Date(habitEndDate)
      stoppedDate.setHours(0, 0, 0, 0)

      // If stopped date is in the past or today, mark from stopped date to today
      // If stopped date is in the future, mark from today to stopped date
      if (stoppedDate <= today) {
        rangeStart = stoppedDate
        rangeEnd = today
      } else {
        rangeStart = today
        rangeEnd = stoppedDate
      }
    }

    // Generate all days from the start Sunday to Dec 31 using date strings to avoid DST issues
    let currentDate = new Date(startDate_calc)
    currentDate.setHours(12, 0, 0, 0) // Use noon to avoid DST issues

    while (currentDate <= dec31) {
      const dateStr = currentDate.toISOString().split('T')[0]

      // Skip if we've already seen this date
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr)

        // Auto-complete days if they're within the habit's active range
        let isCompleted = false
        if (rangeStart && rangeEnd) {
          const checkDate = new Date(dateStr)
          isCompleted = checkDate >= rangeStart && checkDate <= rangeEnd
        }

        dates.push({
          date: dateStr,
          completed: isCompleted
        })
      }

      // Move to next day by incrementing the date (not milliseconds)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates
  }

  const addHabit = () => {
    if (!newHabitName.trim()) return

    const dateStoppedStr = dateStoppedInput ? format(dateStoppedInput, 'yyyy-MM-dd') : undefined

    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName,
      dateCreated: new Date().toISOString().split('T')[0],
      dateStopped: dateStoppedStr,
      days: generateDates(new Date().toISOString().split('T')[0], dateStoppedStr)
    }

    setHabits([...habits, newHabit])
    setNewHabitName("")
    setDateStoppedInput(null)
    setShowNewHabitForm(false)
  }

  const cancelNewHabit = () => {
    setNewHabitName("")
    setDateStoppedInput(null)
    setShowNewHabitForm(false)
  }

  const removeHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id))
  }

  const toggleDay = (habitId: string, date: string) => {
    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        const dateExists = habit.days.some(day => day.date === date)

        if (dateExists) {
          // Toggle existing date
          return {
            ...habit,
            days: habit.days.map(day =>
              day.date === date ? { ...day, completed: !day.completed } : day
            )
          }
        } else {
          // Add new date as completed
          return {
            ...habit,
            days: [...habit.days, { date, completed: true }].sort((a, b) => a.date.localeCompare(b.date))
          }
        }
      }
      return habit
    }))
  }

  const startEditingHabit = (habitId: string, currentName: string) => {
    setEditingHabitId(habitId)
    setEditingHabitName(currentName)
  }

  const saveHabitName = (habitId: string) => {
    if (!editingHabitName.trim()) return

    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        return {
          ...habit,
          name: editingHabitName.trim()
        }
      }
      return habit
    }))
    setEditingHabitId(null)
    setEditingHabitName("")
  }

  const cancelEditingHabit = () => {
    setEditingHabitId(null)
    setEditingHabitName("")
  }

  const manualSave = async () => {
    try {
      const root = await navigator.storage.getDirectory()
      const fileHandle = await root.getFileHandle('habit-tracker-data.json', { create: true })
      const writable = await fileHandle.createWritable()

      const data: HabitData = {
        habits,
        completedColor,
        showStreak,
        viewMode
      }

      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      setLastSaved(new Date())
      console.log('Manual save complete')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving data')
    }
  }

  const saveToFile = () => {
    const data: HabitData = {
      habits,
      completedColor,
      showStreak,
      viewMode
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'habit-tracker-data.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const loadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as HabitData
        setHabits(data.habits)

        // Restore preferences if they exist in the file (backward compatible)
        if (data.completedColor) {
          setCompletedColor(data.completedColor)
        }
        if (data.showStreak) {
          setShowStreak(data.showStreak)
        }
        if (data.viewMode) {
          setViewMode(data.viewMode)
        }

        // Save imported data to OPFS
        try {
          const root = await navigator.storage.getDirectory()
          const fileHandle = await root.getFileHandle('habit-tracker-data.json', { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(JSON.stringify(data, null, 2))
          await writable.close()
          console.log('Imported data saved to persistent storage')
        } catch (opfsError) {
          console.error('Error saving to OPFS:', opfsError)
        }

        // Reset input so the same file can be selected again
        event.target.value = ''
      } catch (error) {
        alert('Error loading file. Please ensure it\'s a valid habit tracker file.')
        // Reset input on error too
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const getCompletedDays = (habit: Habit) => {
    return habit.days.filter(d => d.completed).length
  }

  const getCurrentStreak = (habit: Habit) => {
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create a map of completed dates for quick lookup
    const completedDatesMap = new Map<string, boolean>()
    habit.days.forEach(day => {
      completedDatesMap.set(day.date, day.completed)
    })

    // Generate 2025 calendar and filter to dates up to today
    const calendar2025 = generate2025Calendar()
    const relevantDates = calendar2025.filter(day => {
      const dayDate = new Date(day.date)
      dayDate.setHours(0, 0, 0, 0)
      return dayDate <= today
    })

    // Start from today and count backwards
    for (let i = relevantDates.length - 1; i >= 0; i--) {
      const day = relevantDates[i]
      const isCompleted = completedDatesMap.get(day.date) || false

      if (isCompleted) {
        streak++
      } else {
        // Break the streak if we find an incomplete day
        break
      }
    }

    return streak
  }

  const getEarliestCompletedDate = (habit: Habit) => {
    const completedDays = habit.days.filter(d => d.completed)
    if (completedDays.length === 0) return null

    // Find the earliest date
    const earliest = completedDays.reduce((earliest, day) => {
      return day.date < earliest.date ? day : earliest
    })

    return earliest.date
  }

  // Generate fixed 2025 calendar year for display
  const generate2025Calendar = () => {
    const dates: DayStatus[] = []

    // Start from January 1st, 2025
    const jan1 = new Date(2025, 0, 1)
    jan1.setHours(0, 0, 0, 0)

    // End at December 31st, 2025
    const dec31 = new Date(2025, 11, 31)
    dec31.setHours(0, 0, 0, 0)

    // Find the Sunday before or on Jan 1 (for proper week alignment)
    const dayOfWeek = jan1.getDay()
    const startDate = new Date(jan1)
    startDate.setDate(jan1.getDate() - dayOfWeek)

    // Generate from that Sunday to Dec 31
    let currentDate = new Date(startDate)
    currentDate.setHours(12, 0, 0, 0)

    while (currentDate <= dec31) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dates.push({
        date: dateStr,
        completed: false // Will be overridden when we check habit.days
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setHabits((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const startCheckIn = () => {
    const today = new Date().toISOString().split('T')[0]
    const initialSelections: {[key: string]: boolean | null} = {}

    // Pre-populate with today's status
    habits.forEach(habit => {
      const todayStatus = habit.days.find(day => day.date === today)
      initialSelections[habit.id] = todayStatus ? todayStatus.completed : null
    })

    setCheckInSelections(initialSelections)
    setCheckInHasInteracted(false)
    setCheckInMode(true)
  }

  const handleCheckInSelection = (habitId: string, completed: boolean) => {
    setCheckInHasInteracted(true)
    setCheckInSelections(prev => ({
      ...prev,
      [habitId]: completed
    }))
  }

  const saveCheckIn = () => {
    const today = new Date().toISOString().split('T')[0]

    setHabits(habits.map(habit => {
      const selection = checkInSelections[habit.id]
      if (selection === null || selection === undefined) return habit

      const todayExists = habit.days.some(day => day.date === today)

      if (todayExists) {
        // Update existing day
        return {
          ...habit,
          days: habit.days.map(day =>
            day.date === today ? { ...day, completed: selection } : day
          )
        }
      } else {
        // Add today's date to the days array
        return {
          ...habit,
          days: [...habit.days, { date: today, completed: selection }].sort((a, b) => a.date.localeCompare(b.date))
        }
      }
    }))

    setCheckInMode(false)
    setCheckInSelections({})
  }

  // Auto-save when all habits are checked AND user has interacted
  useEffect(() => {
    if (!checkInMode || !checkInHasInteracted) return

    const allChecked = habits.every(habit =>
      checkInSelections[habit.id] !== null && checkInSelections[habit.id] !== undefined
    )

    if (allChecked && habits.length > 0) {
      saveCheckIn()
    }
  }, [checkInSelections, checkInMode, checkInHasInteracted])

  // Sortable Habit Card Component
  const SortableHabitCard = ({ habit, compact = false }: { habit: Habit; compact?: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: habit.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const selection = checkInSelections[habit.id]

    // Compact grid view
    if (compact) {
      return (
        <Card
          ref={setNodeRef}
          style={style}
          key={habit.id}
          className={cn(
            "group p-6 hover:shadow-md transition-all",
            reorderMode && "cursor-grab active:cursor-grabbing",
            isDragging && "shadow-2xl ring-2 ring-primary"
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              {reorderMode && !checkInMode && (
                <div {...attributes} {...listeners} className="mr-2 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {checkInMode ? (
                <h3 className="text-lg font-semibold">{habit.name}</h3>
              ) : editingHabitId === habit.id ? (
                <>
                  <input
                    type="text"
                    value={editingHabitName}
                    onChange={(e) => setEditingHabitName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveHabitName(habit.id)
                      if (e.key === 'Escape') cancelEditingHabit()
                    }}
                    className="text-xl font-semibold bg-transparent border-none outline-none focus:outline-none p-0 flex-1 min-w-0"
                    autoFocus
                  />
                  <div className="flex gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => saveHabitName(habit.id)}
                      className="h-7 w-7"
                      title="Save"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelEditingHabit}
                      className="h-7 w-7"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">{habit.name}</h3>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditingHabit(habit.id, habit.name)}
                      className="h-7 w-7"
                      title="Edit name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHabit(habit.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {checkInMode ? (
              <div className="flex gap-3 justify-center items-center mt-2">
                <Button
                  onClick={() => handleCheckInSelection(habit.id, true)}
                  variant={selection === true ? "default" : "outline"}
                  size="lg"
                  className={cn(
                    "gap-2 flex-1",
                    selection === true && "bg-green-600 hover:bg-green-700 text-white"
                  )}
                >
                  <CheckCircle2 className="h-6 w-6" />
                  Done
                </Button>
                <Button
                  onClick={() => handleCheckInSelection(habit.id, false)}
                  variant={selection === false ? "default" : "outline"}
                  size="lg"
                  className={cn(
                    "gap-2 flex-1",
                    selection === false && "bg-red-600 hover:bg-red-700 text-white"
                  )}
                >
                  <XCircle className="h-6 w-6" />
                  Skip
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowStreak({...showStreak, [habit.id]: !showStreak[habit.id]})}
                  className={cn(
                    "flex items-baseline gap-2 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer",
                    showStreak[habit.id]
                      ? "px-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 shadow-sm shadow-orange-500/10"
                      : "hover:bg-muted/50"
                  )}
                  title={showStreak[habit.id] ? "Click to show total days" : "Click to show current streak"}
                >
                  <span className={cn(
                    "text-3xl font-bold",
                    showStreak[habit.id] && "bg-gradient-to-br from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent"
                  )}>
                    {showStreak[habit.id] ? getCurrentStreak(habit) : getCompletedDays(habit)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {showStreak[habit.id]
                      ? getCurrentStreak(habit) === 1 ? "day streak" : "day streak"
                      : getCompletedDays(habit) === 1 ? "day" : "days"}
                  </span>
                </button>

                {getEarliestCompletedDate(habit) && (
                  <p className="text-xs text-muted-foreground">
                    Since {format(new Date(getEarliestCompletedDate(habit)!), 'do MMMM yyyy')}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      )
    }

    // Full list view with flamegraph
    return (
      <Card
        ref={setNodeRef}
        style={style}
        key={habit.id}
        className={cn(
          "group p-6 hover:shadow-md transition-all relative",
          reorderMode && "cursor-grab active:cursor-grabbing",
          isDragging && "shadow-2xl ring-2 ring-primary"
        )}
      >
        {/* Check-in overlays */}
        {checkInMode && (
          <>
            {/* Centered title overlay */}
            <div className="absolute top-6 left-6 right-6 z-20">
              <h3 className="text-xl font-semibold text-center">{habit.name}</h3>
            </div>

            {/* Centered buttons overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-4 z-20">
              <Button
                onClick={() => handleCheckInSelection(habit.id, true)}
                variant={selection === true ? "default" : "outline"}
                size="lg"
                className={cn(
                  "gap-2 px-12 py-6 text-lg",
                  selection === true && "bg-green-600 hover:bg-green-700 text-white"
                )}
              >
                <CheckCircle2 className="h-6 w-6" />
                Done
              </Button>
              <Button
                onClick={() => handleCheckInSelection(habit.id, false)}
                variant={selection === false ? "default" : "outline"}
                size="lg"
                className={cn(
                  "gap-2 px-12 py-6 text-lg",
                  selection === false && "bg-red-600 hover:bg-red-700 text-white"
                )}
              >
                <XCircle className="h-6 w-6" />
                Skip
              </Button>
            </div>
          </>
        )}

        {/* Main content - always rendered, just blurred in check-in mode */}
        <div className={cn("flex flex-col lg:flex-row gap-6", checkInMode && "blur-[3px] pointer-events-none")}>
          <div className="lg:w-56 flex-shrink-0">
            <div className="flex items-start justify-between mb-3">
              {reorderMode && !checkInMode && (
                <div {...attributes} {...listeners} className="mr-2 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {editingHabitId === habit.id ? (
                <>
                  <input
                    type="text"
                    value={editingHabitName}
                    onChange={(e) => setEditingHabitName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveHabitName(habit.id)
                      if (e.key === 'Escape') cancelEditingHabit()
                    }}
                    className="text-xl font-semibold bg-transparent border-none outline-none focus:outline-none p-0 flex-1 min-w-0"
                    autoFocus
                  />
                  <div className="flex gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => saveHabitName(habit.id)}
                      className="h-7 w-7"
                      title="Save"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelEditingHabit}
                      className="h-7 w-7"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold">{habit.name}</h3>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditingHabit(habit.id, habit.name)}
                      className="h-7 w-7"
                      title="Edit name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHabit(habit.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowStreak({...showStreak, [habit.id]: !showStreak[habit.id]})}
                className={cn(
                  "flex items-baseline gap-2 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer",
                  showStreak[habit.id]
                    ? "px-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 shadow-sm shadow-orange-500/10"
                    : "hover:bg-muted/50"
                )}
                title={showStreak[habit.id] ? "Click to show total days" : "Click to show current streak"}
              >
                <span className={cn(
                  "text-3xl font-bold",
                  showStreak[habit.id] && "bg-gradient-to-br from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent"
                )}>
                  {showStreak[habit.id] ? getCurrentStreak(habit) : getCompletedDays(habit)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {showStreak[habit.id]
                    ? getCurrentStreak(habit) === 1 ? "day streak" : "day streak"
                    : getCompletedDays(habit) === 1 ? "day" : "days"}
                </span>
              </button>

              {getEarliestCompletedDate(habit) && (
                <p className="text-xs text-muted-foreground">
                  Since {format(new Date(getEarliestCompletedDate(habit)!), 'do MMMM yyyy')}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <div className="w-full">
              {/* GitHub-style contribution graph */}
              <div className="flex gap-1 w-full">
                {/* Day labels (Mon, Wed, Fri) - GitHub style */}
                <div className="flex flex-col gap-[3px] justify-start pt-5 pr-2">
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center"></div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center">Mon</div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center"></div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center">Wed</div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center"></div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center">Fri</div>
                  <div className="h-[14px] max-h-[14px] text-[9px] text-muted-foreground flex items-center"></div>
                </div>

                {/* Weeks grid */}
                <div className="flex-1">
                  {/* Month labels */}
                  <div className="flex gap-[3px] mb-1 h-4 w-full justify-between">
                    {(() => {
                      // Generate fixed 2025 calendar
                      const calendar2025 = generate2025Calendar()

                      // Group days into weeks (columns)
                      const weeks: DayStatus[][] = []
                      for (let i = 0; i < calendar2025.length; i += 7) {
                        weeks.push(calendar2025.slice(i, i + 7))
                      }

                      let currentMonth = ''

                      return weeks.map((week, weekIdx) => {
                        if (week.length === 0) return <div key={weekIdx} className="flex-1" />

                        const weekStart = new Date(week[0].date)
                        const month = format(weekStart, 'MMM')
                        const showLabel = month !== currentMonth
                        currentMonth = month

                        return (
                          <div key={weekIdx} className="flex-1 text-[9px] text-muted-foreground">
                            {showLabel ? month : ''}
                          </div>
                        )
                      })
                    })()}
                  </div>

                  {/* Contribution squares */}
                  <div className="flex gap-[3px] w-full justify-between">
                    {(() => {
                      // Generate fixed 2025 calendar
                      const calendar2025 = generate2025Calendar()

                      // Create a map of habit's completed dates for quick lookup
                      const completedDatesMap = new Map<string, boolean>()
                      habit.days.forEach(day => {
                        completedDatesMap.set(day.date, day.completed)
                      })

                      // Group days into weeks (columns)
                      const weeks: DayStatus[][] = []
                      for (let i = 0; i < calendar2025.length; i += 7) {
                        weeks.push(calendar2025.slice(i, i + 7))
                      }

                      return weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="flex flex-col gap-[3px] flex-1">
                          {week.map((day, dayIdx) => {
                            const date = new Date(day.date)
                            const isToday = day.date === new Date().toISOString().split('T')[0]
                            const isCompleted = completedDatesMap.get(day.date) || false

                            return (
                              <button
                                key={day.date}
                                onClick={() => toggleDay(habit.id, day.date)}
                                style={isCompleted ? {
                                  backgroundColor: completedColor,
                                  borderColor: completedColor,
                                } : undefined}
                                className={`
                                  w-full aspect-square max-w-[14px] rounded-[2px] transition-all hover:scale-110 border
                                  ${isCompleted
                                    ? ''
                                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                  }
                                  ${isToday ? 'ring-1 ring-zinc-400 dark:ring-zinc-600' : ''}
                                `}
                                title={`${date.toLocaleDateString()} - ${isCompleted ? 'Completed' : 'Not completed'}`}
                              />
                            )
                          })}
                          {/* Fill remaining days in week with empty cells */}
                          {Array.from({ length: 7 - week.length }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="w-full aspect-square max-w-[14px]" />
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Progress Tracker
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm">Build better habits, one day at a time</p>
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  • Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {checkInMode ? (
              <Button
                onClick={saveCheckIn}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save & Close
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setShowNewHabitForm(!showNewHabitForm)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Habit
                </Button>
                <Button
                  onClick={startCheckIn}
                  variant="default"
                  size="sm"
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Check-In
                </Button>
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Preferences
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Color Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setReorderMode(!reorderMode)}>
                        <GripVertical className="h-4 w-4 mr-2" />
                        {reorderMode ? "Exit Reorder" : "Reorder Habits"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    File
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={manualSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={saveToFile}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'list' | 'grid')} className="border rounded-md">
              <ToggleGroupItem
                value="list"
                aria-label="List view"
                className={cn(
                  "gap-2",
                  viewMode === 'list' && "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 hover:text-white dark:hover:text-zinc-900"
                )}
              >
                <LayoutList className="h-4 w-4" />
                List
              </ToggleGroupItem>
              <ToggleGroupItem
                value="grid"
                aria-label="Grid view"
                className={cn(
                  "gap-2",
                  viewMode === 'grid' && "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 hover:text-white dark:hover:text-zinc-900"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </ToggleGroupItem>
            </ToggleGroup>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={loadFromFile}
              className="hidden"
            />
          </div>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: "1.5rem" }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Color Settings</h2>
                    <p className="text-sm text-muted-foreground">Customize your habit tracker appearance</p>
                  </div>
                  <Button
                    onClick={() => setShowSettings(false)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Completed Square Color</label>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="color"
                            value={completedColor}
                            onChange={(e) => setCompletedColor(e.target.value)}
                            className="h-12 w-12 rounded-md border-2 border-input cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          <Input
                            type="text"
                            value={completedColor}
                            onChange={(e) => setCompletedColor(e.target.value)}
                            className="font-mono text-sm max-w-[120px]"
                            placeholder="#000000"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompletedColor("#18181b")}
                          >
                            Reset to Default
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium block">Color Presets</label>
                      <div className="grid grid-cols-7 gap-2">
                        {[
                          { name: "Black", color: "#18181b" },
                          { name: "Blue", color: "#3b82f6" },
                          { name: "Green", color: "#22c55e" },
                          { name: "Purple", color: "#a855f7" },
                          { name: "Red", color: "#ef4444" },
                          { name: "Orange", color: "#f97316" },
                          { name: "Pink", color: "#ec4899" },
                        ].map((preset) => (
                          <Button
                            key={preset.color}
                            variant="outline"
                            size="sm"
                            onClick={() => setCompletedColor(preset.color)}
                            className={cn(
                              "h-12 w-full p-0 border-2 hover:scale-105 transition-transform relative group",
                              completedColor === preset.color && "ring-2 ring-primary ring-offset-2"
                            )}
                            style={{ backgroundColor: preset.color }}
                            title={preset.name}
                          >
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-white bg-black/50 rounded">
                              {preset.name}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showNewHabitForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: "1.5rem" }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Add New Habit</h2>
                  <Button
                    onClick={cancelNewHabit}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Habit Name</label>
                    <Input
                      placeholder="e.g., Morning workout, Read for 30min..."
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addHabit()}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <DatePicker
                      selected={dateStoppedInput}
                      onChange={(date: Date | null) => setDateStoppedInput(date)}
                      dateFormat="MMM d, yyyy"
                      placeholderText="Pick a date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      wrapperClassName="w-full"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={cancelNewHabit}
                      variant="outline"
                      className="w-full md:w-auto px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={addHabit}
                      className="w-full md:w-auto px-8"
                    >
                      Add Habit
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={habits.map(h => h.id)}
            strategy={verticalListSortingStrategy}
            disabled={!reorderMode}
          >
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
              {habits.length === 0 ? (
            <Card className="p-12 text-center border-dashed col-span-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    No habits yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add your first habit above to start tracking
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            habits.map((habit) => (
              <SortableHabitCard key={habit.id} habit={habit} compact={viewMode === 'grid'} />
            ))
          )}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Click on any square to mark a day as complete. Your data is stored locally.</p>
          <p className="mt-1">Use Save/Load buttons to backup and restore your progress.</p>
        </div>
      </div>
    </div>
  )
}
