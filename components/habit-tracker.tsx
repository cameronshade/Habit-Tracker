"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Download, Upload, Trash2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

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
}

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [newHabitName, setNewHabitName] = useState("")
  const [dateStoppedInput, setDateStoppedInput] = useState<Date | null>(null)
  const [showStreak, setShowStreak] = useState<{[key: string]: boolean}>({})

  // Generate dates for a full year (GitHub style)
  const generateDates = (habitStartDate: string, habitEndDate?: string) => {
    const dates: DayStatus[] = []
    const seenDates = new Set<string>()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Start from 1 year ago
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    oneYearAgo.setHours(0, 0, 0, 0)

    // Find the most recent Sunday before or on oneYearAgo (GitHub starts weeks on Sunday)
    const dayOfWeek = oneYearAgo.getDay()
    const startDate_calc = new Date(oneYearAgo)
    startDate_calc.setDate(oneYearAgo.getDate() - dayOfWeek)

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

    // Generate all days from the start Sunday to today using milliseconds
    const startTime = startDate_calc.getTime()
    const endTime = today.getTime()
    const oneDay = 24 * 60 * 60 * 1000 // milliseconds in a day

    for (let time = startTime; time <= endTime; time += oneDay) {
      const currentDate = new Date(time)
      currentDate.setHours(0, 0, 0, 0)
      const dateStr = currentDate.toISOString().split('T')[0]

      // Skip if we've already seen this date (handles DST edge cases)
      if (seenDates.has(dateStr)) continue
      seenDates.add(dateStr)

      // Auto-complete days if they're within the habit's active range
      let isCompleted = false
      if (rangeStart && rangeEnd) {
        isCompleted = currentDate >= rangeStart && currentDate <= rangeEnd
      }

      dates.push({
        date: dateStr,
        completed: isCompleted
      })
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
  }

  const removeHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id))
  }

  const toggleDay = (habitId: string, date: string) => {
    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        return {
          ...habit,
          days: habit.days.map(day =>
            day.date === date ? { ...day, completed: !day.completed } : day
          )
        }
      }
      return habit
    }))
  }

  const resetHabit = (habitId: string) => {
    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        return {
          ...habit,
          days: habit.days.map(day => ({ ...day, completed: false }))
        }
      }
      return habit
    }))
  }

  const saveToFile = () => {
    const data: HabitData = { habits }
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
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as HabitData
        setHabits(data.habits)
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

    // Start from today and count backwards
    for (let i = habit.days.length - 1; i >= 0; i--) {
      const day = habit.days[i]
      const dayDate = new Date(day.date)
      dayDate.setHours(0, 0, 0, 0)

      // Only count up to today
      if (dayDate > today) continue

      if (day.completed) {
        streak++
      } else {
        // Break the streak if we find an incomplete day
        break
      }
    }

    return streak
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Progress Tracker
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Build better habits, one day at a time</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveToFile}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <label className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={loadFromFile}
                className="hidden"
              />
              <Upload className="h-4 w-4" />
              Import
            </label>
          </div>
        </div>

        <Card className="p-6 mb-6">
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
              <label className="text-sm font-medium mb-2 block">End Date (optional)</label>
              <DatePicker
                selected={dateStoppedInput}
                onChange={(date: Date | null) => setDateStoppedInput(date || undefined)}
                dateFormat="MMM d, yyyy"
                placeholderText="Pick a date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                wrapperClassName="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addHabit}
                className="w-full md:w-auto px-8"
              >
                Add Habit
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {habits.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
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
              <Card key={habit.id} className="group p-6 hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-56 flex-shrink-0">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold">{habit.name}</h3>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetHabit(habit.id)}
                          className="h-7 w-7"
                          title="Reset all days"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
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
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => setShowStreak({...showStreak, [habit.id]: !showStreak[habit.id]})}
                        className={cn(
                          "flex items-baseline gap-2 px-3 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer",
                          showStreak[habit.id]
                            ? "bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 shadow-sm shadow-orange-500/10"
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
                          {showStreak[habit.id] ? "day streak" : "days"}
                        </span>
                      </button>

                      {habit.dateStopped && (
                        <p className="text-xs text-muted-foreground">
                          Since {format(new Date(habit.dateStopped), 'do MMMM yyyy')}
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
                          <div className="relative flex gap-[3px] mb-1 h-4">
                            {(() => {
                              const monthLabels: { month: string; weekIndex: number }[] = []
                              let currentMonth = ''

                              // Group days into weeks and track month changes
                              for (let i = 0; i < habit.days.length; i += 7) {
                                const weekStart = new Date(habit.days[i].date)
                                const month = format(weekStart, 'MMM')
                                const weekIndex = Math.floor(i / 7)

                                if (month !== currentMonth) {
                                  monthLabels.push({ month, weekIndex })
                                  currentMonth = month
                                }
                              }

                              return monthLabels.map((label, idx) => (
                                <div
                                  key={idx}
                                  className="text-[9px] text-muted-foreground absolute"
                                  style={{
                                    left: `${label.weekIndex * 13}px`
                                  }}
                                >
                                  {label.month}
                                </div>
                              ))
                            })()}
                          </div>

                          {/* Contribution squares */}
                          <div className="flex gap-[3px] w-full justify-between">
                            {(() => {
                              // Group days into weeks (columns)
                              const weeks: DayStatus[][] = []
                              for (let i = 0; i < habit.days.length; i += 7) {
                                weeks.push(habit.days.slice(i, i + 7))
                              }

                              return weeks.map((week, weekIdx) => (
                                <div key={weekIdx} className="flex flex-col gap-[3px] flex-1">
                                  {week.map((day, dayIdx) => {
                                    const date = new Date(day.date)
                                    const isToday = day.date === new Date().toISOString().split('T')[0]

                                    return (
                                      <button
                                        key={day.date}
                                        onClick={() => toggleDay(habit.id, day.date)}
                                        className={`
                                          w-full aspect-square max-w-[14px] rounded-[2px] transition-all hover:scale-110
                                          ${day.completed
                                            ? 'bg-zinc-900 dark:bg-zinc-100 border border-zinc-800 dark:border-zinc-200'
                                            : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                          }
                                          ${isToday ? 'ring-1 ring-zinc-400 dark:ring-zinc-600' : ''}
                                        `}
                                        title={`${date.toLocaleDateString()} - ${day.completed ? 'Completed' : 'Not completed'}`}
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
            ))
          )}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Click on any square to mark a day as complete. Your data is stored locally.</p>
          <p className="mt-1">Use Save/Load buttons to backup and restore your progress.</p>
        </div>
      </div>
    </div>
  )
}
