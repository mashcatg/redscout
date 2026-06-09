"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  index = 0,
  timings = [2.8, 3, 3.2, 3.4, 3.6, 3.8],
  curvature = 0,
  pathColor = "rgb(107, 114, 128)",
  pathWidth = 1.5,
  pathOpacity = 0.3,
  gradientStartColor = "hsl(33, 100%, 50%)",
  gradientStopColor = "hsl(33, 100%, 50%)",
}: {
  containerRef: RefObject<HTMLDivElement | null>
  fromRef: RefObject<HTMLDivElement | null>
  toRef: RefObject<HTMLDivElement | null>
  index?: number
  timings?: number[]
  curvature?: number
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
}) {
  const [pathD, setPathD] = useState("")
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  const idRef = useRef(`beam-${Math.random().toString(16).slice(2)}`)

  // Calculate cumulative timing for this beam
  const startTime = timings.slice(0, index).reduce((a, b) => a + b, 0)
  const duration = timings[index]
  const totalCycleDuration = timings.reduce((a, b) => a + b, 0) + 2

  const startPercent = (startTime / totalCycleDuration) * 100
  const endPercent = ((startTime + duration) / totalCycleDuration) * 100

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const rectA = fromRef.current.getBoundingClientRect()
        const rectB = toRef.current.getBoundingClientRect()

        const svgWidth = containerRect.width
        const svgHeight = containerRect.height
        setSvgDimensions({ width: svgWidth, height: svgHeight })

        const startX = rectA.left - containerRect.left + rectA.width / 2
        const startY = rectA.top - containerRect.top + rectA.height / 2
        const endX = rectB.left - containerRect.left + rectB.width / 2
        const endY = rectB.top - containerRect.top + rectB.height / 2

        const controlY = startY - curvature
        const d = `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`
        setPathD(d)
      }
    }

    const resizeObserver = new ResizeObserver(updatePath)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    updatePath()

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef, fromRef, toRef, curvature])

  const id = idRef.current
  const animationName = `beam-sequence-${index}`

  return (
    <>
      <style>{`
        @keyframes ${animationName} {
          0% { 
            opacity: 0;
            stroke-dasharray: 0, 100%;
            --gradient-start: 10%;
            --gradient-end: 20%;
          }
          ${startPercent}% { 
            opacity: 1;
            stroke-dasharray: 0, 100%;
            --gradient-start: 10%;
            --gradient-end: 20%;
          }
          ${(startPercent + endPercent) / 2}% {
            opacity: 1;
            stroke-dasharray: 100%, 0%;
            --gradient-start: 45%;
            --gradient-end: 55%;
          }
          ${endPercent}% { 
            opacity: 1;
            stroke-dasharray: 100%, 0%;
            --gradient-start: 80%;
            --gradient-end: 90%;
          }
          ${endPercent + 0.5}% { 
            opacity: 0;
            stroke-dasharray: 100%, 0%;
            --gradient-start: 100%;
            --gradient-end: 110%;
          }
          100% { 
            opacity: 0;
          }
        }
      `}</style>
      <svg
        fill="none"
        width={svgDimensions.width}
        height={svgDimensions.height}
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute top-0 left-0 transform-gpu"
        viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
      >
        {/* Grey static path */}
        <path
          d={pathD}
          stroke={pathColor}
          strokeWidth={pathWidth}
          strokeOpacity={pathOpacity}
          strokeLinecap="round"
        />

        {/* Animated beam with gradient */}
        <path
          d={pathD}
          strokeWidth={pathWidth}
          stroke={`url(#${id})`}
          strokeOpacity="1"
          strokeLinecap="round"
          style={{
            animation: `${animationName} ${totalCycleDuration}s ease-in-out infinite`,
          }}
        />

        <defs>
          <linearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={gradientStartColor} stopOpacity="0" />
            <stop offset="25%" stopColor={gradientStartColor} stopOpacity="0.8" />
            <stop offset="75%" stopColor={gradientStopColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </>
  )
}
