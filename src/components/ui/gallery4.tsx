"use client"

import Link from "next/link"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

export interface Gallery4Item {
  id: string
  title: string
  description: string
  href: string
  image: string
}

export interface Gallery4Props {
  title?: string
  description?: string
  items: Gallery4Item[]
}

const Gallery4 = ({
  title = "Разделы",
  description,
  items,
}: Gallery4Props) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (!carouselApi) {
      return
    }
    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
      setCurrentSlide(carouselApi.selectedScrollSnap())
    }
    updateSelection()
    carouselApi.on("select", updateSelection)
    return () => {
      carouselApi.off("select", updateSelection)
    }
  }, [carouselApi])

  return (
    <section className="py-6 md:py-8">
      <div className="container mx-auto px-0">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h2>
            {description && (
              <p className="max-w-lg text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="hidden shrink-0 gap-2 md:flex">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => carouselApi?.scrollPrev()}
              disabled={!canScrollPrev}
              className="disabled:pointer-events-auto"
              aria-label="Предыдущий слайд"
            >
              <IconChevronLeft className="size-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => carouselApi?.scrollNext()}
              disabled={!canScrollNext}
              className="disabled:pointer-events-auto"
              aria-label="Следующий слайд"
            >
              <IconChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            breakpoints: {
              "(max-width: 768px)": {
                dragFree: true,
              },
            },
          }}
        >
          <CarouselContent className="ml-0 2xl:ml-[max(1rem,calc(50vw-700px))] 2xl:mr-[max(1rem,calc(50vw-700px))]">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="max-w-[320px] pl-4 lg:max-w-[360px] lg:pl-5"
              >
                <Link href={item.href} className="group block rounded-xl">
                  <div className="group relative h-full min-h-[22rem] max-w-full overflow-hidden rounded-xl md:aspect-[5/4] lg:aspect-[16/9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute size-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0),hsl(var(--primary)/0.4),hsl(var(--primary)/0.8)_100%)] mix-blend-multiply" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-5 text-primary-foreground md:p-6">
                      <div className="mb-2 pt-2 text-lg font-semibold md:mb-3 md:pt-3">
                        {item.title}
                      </div>
                      <div className="mb-6 line-clamp-2 text-sm md:mb-8">
                        {item.description}
                      </div>
                      <div className="flex items-center text-sm">
                        Подробнее{" "}
                        <IconChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {items.length > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {items.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`h-2 w-2 rounded-full transition-colors ${
                  currentSlide === index ? "bg-primary" : "bg-primary/20"
                }`}
                onClick={() => carouselApi?.scrollTo(index)}
                aria-label={`Перейти к слайду ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export { Gallery4 }
