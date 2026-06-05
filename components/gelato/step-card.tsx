import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StepCardProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  title: string;
  description?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  children?: React.ReactNode;
}

const StepCard = React.forwardRef<HTMLDivElement, StepCardProps>(
  ({ className, step, title, description, isActive, isCompleted, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "relative transition-all duration-300 border-border",
          isActive && "ring-2 ring-primary shadow-lg scale-[1.02]",
          isCompleted && "border-success bg-success/5",
          "hover:shadow-md",
          className
        )}
        {...props}
      >
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                isCompleted
                  ? "bg-success text-success-foreground"
                  : isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? "✓" : step}
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
              {children && <div className="pt-2">{children}</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

StepCard.displayName = "StepCard";

export { StepCard };