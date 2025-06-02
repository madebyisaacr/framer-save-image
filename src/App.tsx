import { framer, CanvasNode } from "framer-plugin"
import { useState, useEffect } from "react"
import "./App.css"

export function App() {
    const selection = useSelection()

    useEffect(() => {
        framer.showUI({
            position: "top right",
            width: 300,
            height: 300,
        })
    }, [])

    return (
        <main className="flex-col p-3 w-full">
            <button className="framer-button-primary">Insert Logo</button>
        </main>
    )
}

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}
