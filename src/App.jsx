import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"

export function App() {
    const selection = useSelection()
    const image = useImage()

    const rows = useMemo(() => {
        let result = []

        for (const node of selection) {
            let nodeImages = []
            let type = "frame"

            if (isFrameNode(node)) {
                nodeImages.push(node.backgroundImage)
            } else if (isComponentInstanceNode(node)) {
                type = "component"
                if (node.controls) {
                    for (const value of Object.values(node.controls)) {
                        if (isImageAsset(value)) {
                            nodeImages.push(value)
                        }
                    }
                }
            }

            if (nodeImages.length > 0) {
                result.push({
                    id: node.id,
                    node,
                    images: nodeImages,
                    type,
                })
            }
        }

        return result
    }, [selection])

    useEffect(() => {
        framer.showUI({
            position: "top right",
            width: 260,
            height: 300,
        })
    }, [])

    return image ? <SingleImageView image={image} /> : rows.length > 0 ? <Table rows={rows} /> : <SingleImageView />
}

function SingleImageView({ image }) {
    return (
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden select-none">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img src={image.url} alt={image.altText} className="size-full object-contain" draggable={false} />
                ) : (
                    <span className="text-tertiary">Select an image</span>
                )}
            </div>
            <ImageButtons image={image} />
        </main>
    )
}

function Table({ rows }) {
    return (
        <div className="flex-col gap-1 overflow-auto -mt-1.5 px-3 pb-3">
            <table>
                <thead className="h-10 text-left">
                    <tr className="border-b border-divider">
                        <TableHeading>Name</TableHeading>
                        <TableHeading>Images</TableHeading>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <TableRow key={row.id} row={row} />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function TableHeading({ children }) {
    return <th className="text-tertiary hover:text-primary font-medium transition-colors">{children}</th>
}

function TableRow({ row }) {
    return (
        <tr className="h-10 text-tertiary hover:text-primary transition-colors font-medium border-b border-divider">
            <td className="text-nowrap pr-3 max-w-[175px] truncate">{row.node.name}</td>
            <td>
                <div className="flex-row gap-2">
                    {row.images.map(image => (
                        <div className="w-10 h-[22px] relative rounded-[4px] overflow-hidden bg-secondary">
                            <img
                                src={image.url}
                                alt={image.altText}
                                className="size-full object-cover"
                                draggable={false}
                            />
                            <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
                        </div>
                    ))}
                </div>
            </td>
        </tr>
    )
}

function ImageButtons({ image }) {
    const hasImage = image ? true : false

    async function onCopyImageClick() {
        if (!image) return

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
        if (!image) return

        const success = copyToClipboard(image.url)
        if (success) {
            framer.notify("Image URL copied to clipboard!", { variant: "success" })
        } else {
            framer.notify("Failed to copy image URL", { variant: "error" })
        }
    }

    function onDownloadImageClick() {
        if (!image) return

        const success = downloadFile(image.url, image.id)
        if (success) {
            framer.notify("Image downloaded!", { variant: "success" })
        } else {
            framer.notify("Failed to download image", { variant: "error" })
        }
    }
    return (
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
                <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary h-full">
                    Download
                </button>
            </div>
        </div>
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
