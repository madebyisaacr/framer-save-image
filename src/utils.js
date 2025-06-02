export async function copyToClipboard(text) {
    // Check if the Clipboard API is available
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // Use the Clipboard API
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch (err) {
        console.error("Failed to write to clipboard using clipboard API:", err)
    }

    try {
        // Fallback for browsers that don't support Clipboard API
        let textArea = document.createElement("textarea")
        textArea.value = text

        // Make the textarea out of viewport
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        let successful = document.execCommand("copy")
        document.body.removeChild(textArea)

        return successful
    } catch (err) {
        console.error("Failed to copy text: ", err)
        return false
    }
}

export function downloadFile(url, name) {
    try {
        // Fetch the image as a blob
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                // Create a blob URL
                const blobUrl = window.URL.createObjectURL(blob)

                // Create and trigger download
                const link = document.createElement("a")
                link.href = blobUrl
                link.download = name
                document.body.appendChild(link)
                link.click()

                // Cleanup
                document.body.removeChild(link)
                window.URL.revokeObjectURL(blobUrl)
            })
            .catch(err => {
                console.error(err)
                return false
            })

        return true
    } catch (err) {
        console.error(err)
        return false
    }
}
