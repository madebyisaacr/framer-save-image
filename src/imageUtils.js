import { framer } from "framer-plugin"
import { copyToClipboard, downloadFile } from "./utils"

export async function copyImage(image) {
    if (!image) return

    try {
        // Fetch the image as a blob
        const response = await fetch(image.url)
        const blob = await response.blob()

        // Handle SVG separately by copying as text
        if (blob.type === "image/svg+xml") {
            const text = await blob.text()
            await navigator.clipboard.writeText(text)
            framer.notify("SVG copied to clipboard!", { variant: "success" })
            return true
        }

        // Convert all other image types except PNG to PNG
        let finalBlob = blob
        if (blob.type !== "image/png") {
            // Create an image element to load the image
            const img = new Image()
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")

            // Convert blob to data URL
            const dataUrl = URL.createObjectURL(blob)

            // Wait for image to load
            await new Promise((resolve, reject) => {
                img.onload = resolve
                img.onerror = reject
                img.src = dataUrl
            })

            // Set canvas dimensions to match image
            canvas.width = img.width
            canvas.height = img.height

            // Draw image to canvas
            ctx.drawImage(img, 0, 0)

            // Convert canvas to PNG blob
            finalBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, "image/png")
            })

            // Clean up
            URL.revokeObjectURL(dataUrl)
        }

        // Create a ClipboardItem
        const clipboardItem = new ClipboardItem({ [finalBlob.type]: finalBlob })

        // Write to clipboard
        await navigator.clipboard.write([clipboardItem])
        framer.notify("Image copied to clipboard!", { variant: "success" })
        return true
    } catch (err) {
        console.error(err)
        framer.notify("Failed to copy image", { variant: "error" })
        return false
    }
}

export async function copyImageUrlToClipboard(url) {
    if (!url) return

    const success = await copyToClipboard(url)
    if (success) {
        framer.notify("Image URL copied to clipboard!", { variant: "success" })
    } else {
        framer.notify("Failed to copy image URL", { variant: "error" })
    }
}

export async function downloadImage(image) {
    if (!image) return

    const success = await downloadFile(image.url, image.id)
    if (success) {
        framer.notify("Image downloaded!", { variant: "success" })
    } else {
        framer.notify("Failed to download image", { variant: "error" })
    }
}

export function imageContextMenu(event, image, precedingListItems = []) {
    if (!image) return

    void framer.showContextMenu(
        [
            ...precedingListItems,
            {
                label: "Copy Image",
                onAction: async () => {
                    withLoadingNotification(copyImage(image), "Copying image...")
                },
            },
            {
                label: "Copy URL",
                onAction: async () => {
                    withLoadingNotification(copyImageUrlToClipboard(image.url), "Copying image URL...")
                },
            },
            {
                label: "Download",
                onAction: async () => {
                    withLoadingNotification(downloadImage(image), "Downloading image...")
                },
            },
        ],
        {
            location: {
                x: event.clientX ?? 0,
                y: event.clientY ?? 0,
            },
        }
    )
}

async function withLoadingNotification(promise, message) {
    let notification = null
    const timeout = setTimeout(() => {
        notification = framer.notify(message, { variant: "info", durationMs: 60000 })
    }, 200)

    await promise

    clearTimeout(timeout)
    if (notification) {
        notification.close()
    }
}
