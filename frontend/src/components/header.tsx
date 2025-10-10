"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Calculator } from "lucide-react"
import { useLogout } from "@/hooks/useAuth"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { usePathname } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface HeaderProps {
  dashboardType: 'superadmin' | 'admin' | 'agent'
}

function CalculatorApp() {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [newNumber, setNewNumber] = useState(true)

  const handleNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num)
      setNewNumber(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const handleOperator = (op: string) => {
    const currentValue = parseFloat(display)
    if (previousValue === null) {
      setPreviousValue(currentValue)
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation)
      setDisplay(String(result))
      setPreviousValue(result)
    }
    setOperation(op)
    setNewNumber(true)
  }

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+': return prev + current
      case '-': return prev - current
      case '×': return prev * current
      case '÷': return prev / current
      default: return current
    }
  }

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      const result = calculate(previousValue, parseFloat(display), operation)
      setDisplay(String(result))
      setPreviousValue(null)
      setOperation(null)
      setNewNumber(true)
    }
  }

  const handleClear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setNewNumber(true)
  }

  const handleDecimal = () => {
    if (!display.includes(".")) {
      setDisplay(display + ".")
      setNewNumber(false)
    }
  }

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay("0")
      setNewNumber(true)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handleNumber(e.key)
    } else if (e.key === '+' || e.key === '-') {
      handleOperator(e.key)
    } else if (e.key === '*') {
      handleOperator('×')
    } else if (e.key === '/') {
      e.preventDefault()
      handleOperator('÷')
    } else if (e.key === 'Enter' || e.key === '=') {
      handleEquals()
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      handleClear()
    } else if (e.key === '.') {
      handleDecimal()
    } else if (e.key === 'Backspace') {
      handleBackspace()
    }
  }

  return (
    <div 
      className="w-full max-w-xs mx-auto p-4"
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      <div className="bg-gray-900 rounded-lg p-4 mb-4">
        <div className="text-right text-white text-3xl font-light mb-2 break-words">
          {display}
        </div>
        {operation && (
          <div className="text-right text-gray-400 text-sm">
            {previousValue} {operation}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <Button
          onClick={handleClear}
          className="col-span-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold"
          size="lg"
        >
          C
        </Button>
        <Button
          onClick={handleBackspace}
          className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold"
          size="lg"
        >
          ⌫
        </Button>
        <Button
          onClick={() => handleOperator('÷')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          size="lg"
        >
          ÷
        </Button>

        <Button onClick={() => handleNumber('7')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">7</Button>
        <Button onClick={() => handleNumber('8')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">8</Button>
        <Button onClick={() => handleNumber('9')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">9</Button>
        <Button
          onClick={() => handleOperator('×')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          size="lg"
        >
          ×
        </Button>

        <Button onClick={() => handleNumber('4')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">4</Button>
        <Button onClick={() => handleNumber('5')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">5</Button>
        <Button onClick={() => handleNumber('6')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">6</Button>
        <Button
          onClick={() => handleOperator('-')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          size="lg"
        >
          -
        </Button>

        <Button onClick={() => handleNumber('1')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">1</Button>
        <Button onClick={() => handleNumber('2')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">2</Button>
        <Button onClick={() => handleNumber('3')} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">3</Button>
        <Button
          onClick={() => handleOperator('+')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          size="lg"
        >
          +
        </Button>

        <Button onClick={() => handleNumber('0')} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white" size="lg">0</Button>
        <Button onClick={handleDecimal} className="bg-gray-700 hover:bg-gray-600 text-white" size="lg">.</Button>
        <Button
          onClick={handleEquals}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          size="lg"
        >
          =
        </Button>
      </div>
      
      <p className="text-xs text-gray-500 text-center mt-4">
        Keyboard: 0-9, +, -, *, /, Enter, Esc, Backspace
      </p>
    </div>
  )
}

export function Header({ dashboardType }: HeaderProps) {
  const { logout } = useLogout()
  const pathname = usePathname()

  const getDashboardTitle = () => {
    switch (dashboardType) {
      case 'superadmin':
        return 'Super Admin Dashboard'
      case 'admin':
        return 'Admin Dashboard'
      case 'agent':
        return 'Agent Dashboard'
      default:
        return 'Dashboard'
    }
  }

  const getBreadcrumbs = () => {
    if (dashboardType !== 'agent') return null
    
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length <= 1) return null

    const relevantSegments = segments[0] === 'agent' ? segments.slice(1) : segments
    if (relevantSegments.length === 0) return null

    const breadcrumbs = relevantSegments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 2).join('/')}`
      const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
      return { title, path, isLast: index === relevantSegments.length - 1 }
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-2 px-4 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1 hover:bg-gray-50 rounded-md p-1.5" />
        <div className="h-3 w-px bg-gray-200" />
        
        {dashboardType === 'agent' && breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/agent">Agent</BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((breadcrumb) => (
                <div key={breadcrumb.path} className="flex items-center gap-2">
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    {breadcrumb.isLast ? (
                      <BreadcrumbPage className="font-medium">{breadcrumb.title}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={breadcrumb.path}>{breadcrumb.title}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className="text-sm font-medium text-gray-700">{getDashboardTitle()}</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Calculator className="h-3 w-3 mr-1" />
              Calculator
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Calculator</SheetTitle>
            </SheetHeader>
            <CalculatorApp />
          </SheetContent>
        </Sheet>

        <Separator orientation="vertical" className="h-4" />

        <Button 
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="h-3 w-3 mr-1" />
          Logout
        </Button>
      </div>
    </header>
  )
}


