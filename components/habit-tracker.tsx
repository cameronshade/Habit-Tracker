"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Download, Upload, Trash2, RotateCcw } from "lucide-react"

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
  const [dateStoppedInput, setDateStoppedInput] = useState("")

  // Generate dates for the last 90 days
  const generateDates = (startDate: string, endDate?: string) => {
    const dates: DayStatus[] = []
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date()
    const today = new Date()

    // Ensure we don't go beyond today
    const finalEnd = end > today ? today : end

    for (let d = new Date(start); d <= finalEnd; d.setDate(d.getDate() + 1)) {
      dates.push({
        date: d.toISOString().split('T')[0],
        completed: false
      })
    }
    return dates
  }

  const addHabit = () => {
    if (!newHabitName.trim()) return

    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName,
      dateCreated: new Date().toISOString().split('T')[0],
      dateStopped: dateStoppedInput || undefined,
      days: generateDates(new Date().toISOString().split('T')[0], dateStoppedInput || undefined)
    }

    setHabits([...habits, newHabit])
    setNewHabitName("")
    setDateStoppedInput("")
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
      } catch (error) {
        alert('Error loading file. Please ensure it\'s a valid habit tracker file.')
      }
    }
    reader.readAsText(file)
  }

  const getCompletedDays = (habit: Habit) => {
    return habit.days.filter(d => d.completed).length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Progress Tracker
          </h1>
          <div className="flex gap-2">
            <Button
              onClick={saveToFile}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Save Data
            </Button>
            <label>
              <input
                type="file"
                accept=".json"
                onChange={loadFromFile}
                className="hidden"
              />
              <Button variant="outline" className="gap-2" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Load Data
                </span>
              </Button>
            </label>
          </div>
        </div>

        <Card className="p-6 mb-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Habit</label>
              <Input
                placeholder="Enter habit name..."
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Date stopped (optional)</label>
              <Input
                type="date"
                value={dateStoppedInput}
                onChange={(e) => setDateStoppedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addHabit} className="w-full md:w-auto px-8">
                Add
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {habits.length === 0 ? (
            <Card className="p-12 text-center bg-white/60 dark:bg-slate-900/60 backdrop-blur">
              <p className="text-muted-foreground text-lg">
                No habits yet. Add one above to start tracking!
              </p>
            </Card>
          ) : (
            habits.map((habit) => (
              <Card key={habit.id} className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-48 flex-shrink-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold">{habit.name}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetHabit(habit.id)}
                          className="h-8 w-8"
                          title="Reset all days"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHabit(habit.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {getCompletedDays(habit)} days completed
                    </p>
                    {habit.dateStopped && (
                      <p className="text-sm text-muted-foreground">
                        Stopped: {new Date(habit.dateStopped).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <div className="inline-block min-w-full">
                      <div className="grid gap-1.5" style={{
                        gridTemplateColumns: `repeat(${Math.ceil(habit.days.length / 7)}, minmax(14px, 1fr))`,
                        gridAutoFlow: 'column'
                      }}>
                        {habit.days.map((day, idx) => {
                          const date = new Date(day.date)
                          const isToday = day.date === new Date().toISOString().split('T')[0]

                          return (
                            <button
                              key={day.date}
                              onClick={() => toggleDay(habit.id, day.date)}
                              className={`
                                w-3.5 h-3.5 rounded-sm border transition-all hover:scale-110
                                ${day.completed
                                  ? 'bg-emerald-500 border-emerald-600 dark:bg-emerald-600 dark:border-emerald-700'
                                  : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-400'
                                }
                                ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                              `}
                              title={`${date.toLocaleDateString()} - ${day.completed ? 'Completed' : 'Not completed'}`}
                            />
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{new Date(habit.days[0]?.date).toLocaleDateString()}</span>
                        <span>{new Date(habit.days[habit.days.length - 1]?.date).toLocaleDateString()}</span>
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
