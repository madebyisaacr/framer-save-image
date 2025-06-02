import { framer } from "framer-plugin"
import { useState, useEffect } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"

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

    async function onCopyImageClick() {
        // Fetch the image as a blob
        const response = await fetch(image.url)
        const blob = await response.blob()

        // Create a ClipboardItem
        const clipboardItem = new ClipboardItem({ [blob.type]: blob })

        // Write to clipboard
        try {
            await navigator.clipboard.write([clipboardItem])
            framer.notify("Image copied to clipboard!", { variant: "success" })
        } catch (err) {
            console.error(err)
            framer.notify("Failed to copy image", { variant: "error" })
        }
    }

    function onCopyImageUrlClick() {
        const success = copyToClipboard(image.url)
        if (success) {
            framer.notify("Image URL copied to clipboard!", { variant: "success" })
        } else {
            framer.notify("Failed to copy image URL", { variant: "error" })
        }
    }

    function onDownloadImageClick() {
        const success = downloadFile(image.url, image.id)
        if (success) {
            framer.notify("Image downloaded!", { variant: "success" })
        } else {
            framer.notify("Failed to download image", { variant: "error" })
        }
    }

    return (
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img src={image.url} alt={image.altText} className="size-full object-contain" />
                ) : (
                    <span>Select an image</span>
                )}
            </div>
            <div className="flex-row gap-2">
                <button disabled={!hasImage} onClick={onCopyImageClick} className="flex-1">
                    Copy Image
                </button>
                <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="flex-1">
                    Copy URL
                </button>
            </div>
            <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary">
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
