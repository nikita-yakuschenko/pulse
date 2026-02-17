"use client"

import * as React from "react"
import { IconCalendar, IconX } from "@tabler/icons-react"
import {
  Button as AriaButton,
  DatePicker as AriaDatePicker,
  DatePickerProps as AriaDatePickerProps,
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerProps as AriaDateRangePickerProps,
  DateValue as AriaDateValue,
  Dialog as AriaDialog,
  DialogProps as AriaDialogProps,
  OverlayTriggerStateContext,
  PopoverProps as AriaPopoverProps,
  ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
} from "react-aria-components"
import {
  endOfMonth,
  endOfWeek,
  getLocalTimeZone,
  startOfMonth,
  startOfWeek,
  today,
} from "@internationalized/date"

import { cn } from "@/lib/utils"
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  RangeCalendar,
} from "@/components/ui/calendar-aria"
import { DateInput } from "@/components/ui/datefield"
import { FieldError, FieldGroup, Label } from "@/components/ui/field-aria"
import { Popover } from "@/components/ui/popover-aria"

const DatePicker = AriaDatePicker
const DateRangePicker = AriaDateRangePicker

type QuickSelectRange = { start: AriaDateValue; end: AriaDateValue }
const QuickSelectContext = React.createContext<
  ((range: QuickSelectRange | null) => void) | null
>(null)

const LOCALE = "ru"

function QuickSelectBadges() {
  const onQuickSelect = React.useContext(QuickSelectContext)
  const overlayState = React.useContext(OverlayTriggerStateContext)
  if (!onQuickSelect) return null
  const handle = (start: AriaDateValue, end: AriaDateValue) => {
    onQuickSelect({ start, end })
    overlayState?.close()
  }
  const handleReset = () => {
    onQuickSelect(null)
    overlayState?.close()
  }
  const t = today(getLocalTimeZone())
  const yesterday = t.subtract({ days: 1 })
  const thisWeekStart = startOfWeek(t, LOCALE)
  const thisWeekEnd = endOfWeek(t, LOCALE)
  const thisMonthStart = startOfMonth(t)
  const thisMonthEnd = endOfMonth(t)
  const lastWeekStart = thisWeekStart.subtract({ weeks: 1 })
  const lastWeekEnd = endOfWeek(lastWeekStart, LOCALE)
  const lastMonthStart = startOfMonth(t.subtract({ months: 1 }))
  const lastMonthEnd = endOfMonth(t.subtract({ months: 1 }))

  const btn =
    "rounded-md border border-input bg-transparent px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={btn} onClick={() => handle(t, t)}>
        Сегодня
      </button>
      <button type="button" className={btn} onClick={() => handle(yesterday, yesterday)}>
        Вчера
      </button>
      <button type="button" className={btn} onClick={() => handle(thisWeekStart, thisWeekEnd)}>
        Текущая неделя
      </button>
      <button type="button" className={btn} onClick={() => handle(thisMonthStart, thisMonthEnd)}>
        Текущий месяц
      </button>
      <button type="button" className={btn} onClick={() => handle(lastWeekStart, lastWeekEnd)}>
        Прошлая неделя
      </button>
      <button type="button" className={btn} onClick={() => handle(lastMonthStart, lastMonthEnd)}>
        Прошлый месяц
      </button>
      <button
        type="button"
        className={cn(
          btn,
          "inline-flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        )}
        onClick={handleReset}
      >
        <IconX aria-hidden className="size-3.5 shrink-0" />
        Сбросить
      </button>
    </div>
  )
}

const DatePickerContent = ({
  className,
  popoverClassName,
  ...props
}: AriaDialogProps & { popoverClassName?: AriaPopoverProps["className"] }) => (
  <Popover
    className={composeRenderProps(popoverClassName, (className) =>
      cn("w-auto p-3", className)
    )}
    style={{ width: "var(--trigger-width)", minWidth: "var(--trigger-width)", maxWidth: "var(--trigger-width)" }}
  >
    <AriaDialog
      className={cn(
        "flex w-full flex-col gap-3 outline-none",
        className
      )}
      {...props}
    />
  </Popover>
)

interface JollyDatePickerProps<T extends AriaDateValue>
  extends AriaDatePickerProps<T> {
  label?: string
  description?: string
  errorMessage?: string | ((validation: AriaValidationResult) => string)
}

function JollyDatePicker<T extends AriaDateValue>({
  label,
  description,
  errorMessage,
  className,
  ...props
}: JollyDatePickerProps<T>) {
  return (
    <DatePicker
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className)
      )}
      {...props}
    >
      <Label>{label}</Label>
      <FieldGroup>
        <DateInput className="flex-1" variant="ghost" />
        <AriaButton
          className="inline-flex size-6 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground data-[focus-visible]:outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-0"
          aria-label="Открыть календарь"
        >
          <IconCalendar aria-hidden className="size-4" />
        </AriaButton>
      </FieldGroup>
      {description && (
        <Text className="text-sm text-muted-foreground" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
      <DatePickerContent>
        <Calendar>
          <CalendarHeading />
          <CalendarGrid>
            <CalendarGridHeader>
              {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(date) => <CalendarCell date={date} />}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </DatePickerContent>
    </DatePicker>
  )
}

interface JollyDateRangePickerProps<T extends AriaDateValue>
  extends AriaDateRangePickerProps<T> {
  label?: string
  description?: string
  errorMessage?: string | ((validation: AriaValidationResult) => string)
  /** Вариант поля: "filter" — в одну линию с другими фильтрами (h-8, те же границы) */
  fieldGroupVariant?: "ghost" | "default" | "filter"
  /** Текст при пустом значении (вместо формата «ДД . ММ . ГГГГ – ДД . ММ . ГГГГ») */
  placeholder?: string
}

function JollyDateRangePicker<T extends AriaDateValue>({
  label,
  description,
  errorMessage,
  className,
  fieldGroupVariant = "ghost",
  placeholder = "Выберите дату или период",
  ...props
}: JollyDateRangePickerProps<T>) {
  const isEmpty = props.value == null
  const calendarButtonRef = React.useRef<HTMLButtonElement>(null)
  type OnChangeValue<T extends AriaDateValue> = Parameters<
    NonNullable<JollyDateRangePickerProps<T>["onChange"]>
  >[0]
  const onQuickSelect = React.useCallback(
    (range: QuickSelectRange | null) =>
      props.onChange?.(
        (range === null ? null : range) as OnChangeValue<T>
      ),
    [props.onChange]
  )
  return (
    <QuickSelectContext.Provider value={onQuickSelect}>
    <DateRangePicker
      className={composeRenderProps(className, (className) =>
        cn(
          "group flex flex-col",
          fieldGroupVariant === "filter" ? "gap-0" : "gap-2",
          className
        )
      )}
      {...props}
    >
      {label ? (
        <Label className={fieldGroupVariant === "filter" ? "text-xs text-muted-foreground" : undefined}>
          {label}
        </Label>
      ) : null}
      <div className={fieldGroupVariant === "filter" ? "relative mt-1" : "relative"}>
        <FieldGroup variant={fieldGroupVariant}>
          <div
            className={cn(
              "flex flex-1 min-w-0 items-center",
              isEmpty && "invisible"
            )}
          >
            <DateInput variant="ghost" slot="start" />
            <span aria-hidden className="px-2 text-sm text-muted-foreground">
              –
            </span>
            <DateInput className="flex-1" variant="ghost" slot="end" />
          </div>
          <AriaButton
            ref={calendarButtonRef}
            className="inline-flex mr-1 size-6 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground data-[focus-visible]:outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-0"
            aria-label="Открыть календарь"
          >
            <IconCalendar aria-hidden className="size-4" />
          </AriaButton>
        </FieldGroup>
        <button
          type="button"
          aria-label={isEmpty ? "Выберите дату или период" : "Открыть выбор периода"}
          className={cn(
            "absolute inset-y-0 left-0 right-8 flex w-full cursor-pointer items-center rounded-l-[inherit] rounded-r-md text-left text-base md:text-sm",
            isEmpty && placeholder
              ? "bg-muted/30 pl-3 text-muted-foreground hover:bg-muted/50 dark:bg-input/30 dark:hover:bg-muted"
              : "bg-transparent pl-3"
          )}
          onClick={() => calendarButtonRef.current?.click()}
        >
          {isEmpty && placeholder ? placeholder : null}
        </button>
      </div>
      {description && (
        <Text className="text-sm text-muted-foreground" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
      <DatePickerContent>
        <QuickSelectBadges />
        <div className="mt-3">
          <RangeCalendar>
            <CalendarHeading />
            <CalendarGrid>
              <CalendarGridHeader>
                {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <CalendarCell date={date} />}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
        </div>
      </DatePickerContent>
    </DateRangePicker>
    </QuickSelectContext.Provider>
  )
}

export {
  DatePicker,
  DatePickerContent,
  DateRangePicker,
  JollyDatePicker,
  JollyDateRangePicker,
}
export type { JollyDatePickerProps, JollyDateRangePickerProps }
