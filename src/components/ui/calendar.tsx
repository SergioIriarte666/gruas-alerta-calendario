
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Force re-render to bust cache
  const cacheKey = React.useMemo(() => `calendar-v2-${Date.now()}`, []);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    props.month || props.selected as Date || new Date()
  );

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const currentYear = currentMonth.getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);

  const handleMonthChange = (monthIndex: string) => {
    const newMonth = new Date(currentMonth.getFullYear(), parseInt(monthIndex), 1);
    setCurrentMonth(newMonth);
    props.onMonthChange?.(newMonth);
  };

  const handleYearChange = (year: string) => {
    const newMonth = new Date(parseInt(year), currentMonth.getMonth(), 1);
    setCurrentMonth(newMonth);
    props.onMonthChange?.(newMonth);
  };

  return (
    <div key={cacheKey} className={cn("bg-background border rounded-lg shadow-lg", className)}>
      {/* Custom Header with Dropdowns */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/50">
        <div className="flex items-center gap-x-2">
          <Select value={currentMonth.getMonth().toString()} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={currentYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-x-1">
          <button
            onClick={() => {
              const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
              setCurrentMonth(newMonth);
              props.onMonthChange?.(newMonth);
            }}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "size-8 p-0"
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => {
              const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
              setCurrentMonth(newMonth);
              props.onMonthChange?.(newMonth);
            }}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "size-8 p-0"
            )}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="p-3">
        <DayPicker
          {...props}
          month={currentMonth}
          showOutsideDays={showOutsideDays}
          className={cn("pointer-events-auto", className)}
          weekStartsOn={1}
          locale={es}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "hidden", // Hide default caption
            caption_label: "hidden",
            nav: "hidden", // Hide default navigation
            nav_button: "hidden",
            nav_button_previous: "hidden",
            nav_button_next: "hidden",
            table: "w-full border-collapse",
            head_row: "flex border-b pb-2 mb-2",
            head_cell: "text-muted-foreground rounded-md w-10 font-medium text-sm text-center",
            row: "flex w-full",
            cell: "size-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              "size-10 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none"
            ),
            day_range_end: "day-range-end",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "day-outside text-muted-foreground/50 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-30",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            IconLeft: () => null,
            IconRight: () => null,
          }}
        />
      </div>
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
