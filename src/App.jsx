import { framer } from "framer-plugin"
import { useState, useEffect } from "react"
import "./App.css"

export function App() {
    const selection = useSelection()
    const image = useImage()

    const hasImage = image ? true : false

    useEffect(() => {
        framer.showUI({
            position: "top right",
            width: 300,
            height: 300,
        })
    }, [])

    return (
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img src={image.url} alt={image.altText} className="size-full object-contain" />
                ) : (
                    <span>Select an image</span>
                )}
            </div>
            <button disabled={!hasImage}>Copy Image</button>
            <button disabled={!hasImage}>Copy Image URL</button>
            <button disabled={!hasImage} className="framer-button-primary">
                Download Image
            </button>
        </main>
    )
}

function useSelection() {
    const [selection, setSelection] = useState([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

function useImage() {
    const [image, setImage] = useState(null)

    useEffect(() => {
        return framer.subscribeToImage(setImage)
    }, [])

    return image
}
