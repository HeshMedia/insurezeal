"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface CardGridSkeletonProps {
  count?: number
  viewMode?: "grid" | "list"
  containerClassName?: string
  cardClassName?: string
  headerClassName?: string
  avatarClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  contentWrapperClassName?: string
  contentLineClassNames?: string[]
  showFooterSkeleton?: boolean
  footerClassName?: string
}

const DEFAULT_CONTENT_LINE_CLASSES = ["h-3 w-full", "h-3 w-3/4"]

export function CardGridSkeleton({
  count = 6,
  viewMode = "grid",
  containerClassName,
  cardClassName,
  headerClassName,
  avatarClassName,
  titleClassName,
  subtitleClassName,
  contentWrapperClassName,
  contentLineClassNames = DEFAULT_CONTENT_LINE_CLASSES,
  showFooterSkeleton = true,
  footerClassName,
}: CardGridSkeletonProps) {
  const resolvedAvatarClassName = avatarClassName ?? "h-12 w-12 rounded-full"
  const resolvedTitleClassName = titleClassName ?? "h-4 w-32"
  const resolvedSubtitleClassName = subtitleClassName ?? "h-3 w-24"
  const resolvedFooterClassName = footerClassName ?? "h-8 w-full mt-4"

  return (
    <div
      className={cn(
        "grid gap-4",
        viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
        containerClassName
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className={cardClassName}>
          <CardHeader className={cn("pb-3", headerClassName)}>
            <div className="flex items-center gap-3">
              <Skeleton className={resolvedAvatarClassName} />
              <div className="space-y-2">
                <Skeleton className={resolvedTitleClassName} />
                <Skeleton className={resolvedSubtitleClassName} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn("space-y-2", contentWrapperClassName)}>
              {contentLineClassNames.map((lineClassName, lineIndex) => (
                <Skeleton key={lineIndex} className={lineClassName} />
              ))}
              {showFooterSkeleton && <Skeleton className={resolvedFooterClassName} />}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
