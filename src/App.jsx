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
            width: 260,
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
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden select-none">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img src={image.url} alt={image.altText} className="size-full object-contain" draggable={false} />
                ) : (
                    <span className="text-tertiary">Select an image</span>
                )}
            </div>
            <div className="flex-row gap-2 w-full">
                <div className="flex-col gap-2 flex-1">
                    <button disabled={!hasImage} onClick={onCopyImageClick} className="">
                        Copy Image
                    </button>
                    <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="">
                        Copy URL
                    </button>
                </div>
                <div className="flex-col gap-2 flex-1">
                    <button
                        disabled={!hasImage}
                        onClick={onDownloadImageClick}
                        className="framer-button-primary h-full"
                    >
                        Download
                    </button>
                </div>
            </div>
        </main>
    )
}

function useSelection() {
    const [selection, setSelection] = useState([])

    useEffect(() => {
        if (framer.mode === "canvas") {
            return framer.subscribeToSelection(setSelection)
        }
    }, [])

    return selection
}

function useImage() {
    const [image, setImage] = useState(null)

    useEffect(() => {
        if (framer.mode === "canvas" || framer.mode === "editImage") {
            return framer.subscribeToImage(setImage)
        }
    }, [])

    return image
}
