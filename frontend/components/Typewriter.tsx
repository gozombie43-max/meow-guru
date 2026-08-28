"use client"
import * as React from "react"
import { useEffect, useState } from "react"
import { motion, type Variants } from "framer-motion"

const RenderTarget = {
    current: () => "preview",
    canvas: "canvas",
    export: "export",
    thumbnail: "thumbnail",
    preview: "preview",
}

function OriginkitBase_Typewriter(props: Props) {
    props = { ...COMPONENT_DEFAULTS, ...props }
    const {
        texts,
        prefix,
        ease,
        deleteSpeed,
        showCursor,
        hideCursorOnType,
        cursorChar,
        cursorAnimationVariants: cursorAnimationVariantsProp,
        font,
        color,
        typedColor,
        cursorColor,
        style,
    } = props

    const renderTarget = RenderTarget.current()
    const isStatic =
        renderTarget === RenderTarget.export ||
        renderTarget === RenderTarget.thumbnail
    const isCanvas = renderTarget === RenderTarget.canvas

    const typeDelayMs = Math.max(0, ((ease as any)?.duration ?? 0.07) * 1000)
    const holdMs = Math.max(0, ((ease as any)?.delay ?? 1.5) * 1000)
    const deleteDelayMs = Math.max(0, (deleteSpeed ?? 0) * 1000)

    const list: string[] = (texts ?? []).filter(
        (t): t is string => typeof t === "string"
    )
    const hasTexts = list.length > 0

    const [displayText, setDisplayText] = useState("")
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)
    const [currentTextIndex, setCurrentTextIndex] = useState(0)

    useEffect(() => {
        if (isStatic) return
        if (!hasTexts) return

        let timeout: ReturnType<typeof setTimeout> | undefined

        const currentText = list[currentTextIndex] ?? ""

        const startTyping = () => {
            if (isDeleting) {
                if (displayText === "") {
                    setIsDeleting(false)
                    setCurrentTextIndex((prev) => (prev + 1) % list.length)
                    setCurrentIndex(0)
                    timeout = setTimeout(() => {}, holdMs)
                } else {
                    timeout = setTimeout(
                        () => setDisplayText((prev) => prev.slice(0, -1)),
                        deleteDelayMs
                    )
                }
            } else {
                if (currentIndex < currentText.length) {
                    timeout = setTimeout(() => {
                        setDisplayText(
                            (prev) => prev + currentText[currentIndex]
                        )
                        setCurrentIndex((prev) => prev + 1)
                    }, typeDelayMs)
                } else if (list.length > 1) {
                    timeout = setTimeout(() => setIsDeleting(true), holdMs)
                }
            }
        }

        startTyping()

        return () => {
            if (timeout) clearTimeout(timeout)
        }
    }, [
        currentIndex,
        displayText,
        isDeleting,
        typeDelayMs,
        deleteDelayMs,
        holdMs,
        currentTextIndex,
        isStatic,
        hasTexts,
    ])

    const textsKey = list.join("")
    useEffect(() => {
        setDisplayText("")
        setCurrentIndex(0)
        setIsDeleting(false)
        setCurrentTextIndex(0)
    }, [textsKey])

    const cursorAnimationVariants: Variants = cursorAnimationVariantsProp ?? {
        initial: { opacity: 0 },
        animate: {
            opacity: 1,
            transition: {
                duration: 0.01,
                repeat: Infinity,
                repeatDelay: 0.4,
                repeatType: "reverse",
            },
        },
    }

    const renderedText = isStatic ? (list[0] ?? "") : displayText
    const currentText = list[currentTextIndex] ?? ""
    const isActivelyTyping =
        !isStatic &&
        hasTexts &&
        (isDeleting || (currentIndex > 0 && currentIndex < currentText.length))
    const cursorHidden = hideCursorOnType && isActivelyTyping

    const cursorResolvedColor =
        cursorColor && cursorColor !== "" ? cursorColor : typedColor

    const typeface = (font ?? {}) as Record<string, any>
    const fontCss = Object.fromEntries(
        Object.entries(typeface).filter(([k]) => k !== "textAlign")
    )

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                ...style,
            }}
        >
            <div
                style={{
                    display: "inline",
                    whiteSpace: "pre-wrap",
                    letterSpacing: "-0.025em",
                    ...fontCss,
                    color,
                }}
            >
                {prefix ? <span>{prefix}</span> : null}
                <span style={{ color: typedColor }}>{renderedText}</span>
                {showCursor &&
                    (isStatic || isCanvas ? (
                        <span
                            style={{
                                color: cursorResolvedColor,
                                marginLeft: "0.25rem",
                                visibility: cursorHidden ? "hidden" : "visible",
                            }}
                        >
                            {cursorChar}
                        </span>
                    ) : (
                        <motion.span
                            variants={cursorAnimationVariants}
                            initial="initial"
                            animate="animate"
                            style={{
                                color: cursorResolvedColor,
                                marginLeft: "0.25rem",
                                visibility: cursorHidden ? "hidden" : "visible",
                            }}
                        >
                            {cursorChar}
                        </motion.span>
                    ))}
            </div>
        </div>
    )
}

type Props = {
    texts?: string[]
    prefix?: string
    ease?: any
    deleteSpeed?: number
    showCursor?: boolean
    hideCursorOnType?: boolean
    cursorChar?: string
    cursorAnimationVariants?: Variants
    font?: Record<string, any>
    color?: string
    typedColor?: string
    cursorColor?: string
    style?: React.CSSProperties
}

const COMPONENT_DEFAULTS = {
    prefix: "",
    color: "#FFFFFF",
    texts: ["Interfaces", "Experiences", "Interactions", "Products"],
    typedColor: "#FFFFFF",
    ease: {
        type: "tween",
        duration: 0.07,
        delay: 1.5,
        ease: "easeInOut",
    } as any,
    deleteSpeed: 0.1,
    showCursor: true,
    hideCursorOnType: false,
    cursorChar: "_",
    cursorColor: "",
    font: {
        fontFamily: "Inter",
        variant: "Regular",
        fontSize: 80,
        lineHeight: "1.4em",
        letterSpacing: "-0.025em",
    } as any,
}

const __originkitPresetProps = {
  "ease": {
    "type": "tween",
    "stiffness": 800,
    "damping": 60,
    "mass": 1,
    "duration": 0.07,
    "delay": 1.5,
    "ease": "easeInOut"
  },
  "showCursor": false,
  "hideCursorOnType": true,
  "font": {
    "variant": "Regular",
    "fontSize": "100px",
    "textAlign": "center",
    "fontFamily": "Inter",
    "fontWeight": 400,
    "lineHeight": "1.4em",
    "letterSpacing": "-0.025em"
  }
};

export default function Typewriter(props: Record<string, unknown>) {
  return <OriginkitBase_Typewriter {...(__originkitPresetProps as Record<string, unknown>)} {...props} />;
}
