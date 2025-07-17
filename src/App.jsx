import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo, useRef } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"
import { useDynamicPluginHeight } from "./useDynamicPluginHeight"
import classNames from "classnames"

const COLUMN_COUNT = 2
const COLUMN_WIDTH = 110
const MAX_IMAGES_CANVAS = 100

export function App() {
    return framer.mode === "collection" ? <CollectionView /> : <CanvasView />
}

function CanvasView() {
    const selection = useSelection()
    const image = useImage()
    const scrollRef = useRef(null)
    const [selectedImageId, setSelectedImageId] = useState(null)

    useDynamicPluginHeight({
        position: "top right",
        width: framer.mode === "editImage" ? 400 : 260,
        maxHeight: 500,
    })

    const images = useMemo(() => {
        if (framer.mode === "editImage") {
            return image ? [image] : []
        } else {
            const allImages = []

            for (const node of selection) {
                if (isFrameNode(node)) {
                    if (isImageAsset(node.backgroundImage)) {
                        allImages.push(node.backgroundImage)
                    }
                } else if (isComponentInstanceNode(node)) {
                    allImages.push(...getImageAssets(node.controls))
                }
            }

            const uniqueImages = []

            if (allImages.length > 0) {
                // Remove duplicate images by id (or by reference if no id)
                const seen = new Set()
                for (const img of allImages) {
                    const key = img && img.id ? img.id : img
                    if (!seen.has(key)) {
                        seen.add(key)
                        uniqueImages.push(img)
                    }
                }
            }

            // Limit to 100 images
            return uniqueImages.slice(0, MAX_IMAGES_CANVAS)
        }
    }, [image, selection])

    const dimensions = useImageDimensions(images)

    // Only use images whose dimensions are loaded
    const imagesWithDimensions = useMemo(() => {
        return images.filter(img => {
            if (!img) return false
            const dim = dimensions[img.id]
            return dim && dim.width && dim.height
        })
    }, [images, dimensions])

    const selectedImage = useMemo(() => {
        const image = imagesWithDimensions.find(image => image.id === selectedImageId)
        if (!image) {
            const firstImage = imagesWithDimensions[0]
            setSelectedImageId(firstImage?.id ?? null)
            return firstImage
        }
        return image
    }, [imagesWithDimensions, selectedImageId])

    const imageColumns = useMemo(() => {
        const heightPerColumn = Array(COLUMN_COUNT).fill(0)
        const columns = Array.from({ length: COLUMN_COUNT }, () => [])

        if (!images.length) return columns

        for (const img of images) {
            const itemHeight = dimensions[img.id] ? calculateImageHeight(img, dimensions) : 40
            const minColumnIndex = heightPerColumn.indexOf(Math.min(...heightPerColumn))
            columns[minColumnIndex].push(img)
            heightPerColumn[minColumnIndex] += itemHeight
        }

        return columns
    }, [images, dimensions])

    return (
        <main className="flex-col gap-3 w-full max-h-[500px] select-none overflow-hidden">
            {images.length <= 1 ? (
                <div className="flex-col w-full relative px-3 pb-3 gap-3 overflow-hidden">
                    {images.length > 1 && <div className="absolute inset-x-3 top-0 h-px bg-divider z-10" />}
                    {images.length === 0 ? (
                        <span className="w-full overflow-hidden bg-tertiary dark:bg-secondary rounded flex center relative text-secondary aspect-video flex-col center gap-2">
                            <div className="size-[22px] relative flex center">
                                <div className="absolute inset-0 rounded-[4px] bg-[var(--framer-color-text)] opacity-15" />
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="22"
                                    height="22"
                                    className="text-secondary"
                                >
                                    <path
                                        d="M 10.838 9.29 C 10.444 8.683 9.556 8.683 9.162 9.29 L 4.504 16.455 C 4.072 17.12 4.549 18 5.343 18 L 14.657 18 C 15.451 18 15.928 17.12 15.496 16.455 Z"
                                        fill="currentColor"
                                    ></path>
                                    <path
                                        d="M 16 4 C 17.105 4 18 4.895 18 6 C 18 7.105 17.105 8 16 8 C 14.895 8 14 7.105 14 6 C 14 4.895 14.895 4 16 4 Z"
                                        fill="currentColor"
                                    ></path>
                                </svg>
                            </div>
                            Select an image
                        </span>
                    ) : (
                        <div className="w-full bg-tertiary dark:bg-secondary rounded flex center relative overflow-hidden">
                            <img
                                src={`${images[0].url}?scale-down-to=512`}
                                alt={images[0].altText}
                                className="size-full object-contain relative rounded-[inherit] max-h-[400px]"
                                draggable={false}
                            />
                            <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
                        </div>
                    )}
                    <ImageButtons image={images[0]} />
                </div>
            ) : (
                <div className="flex-col w-full relative overflow-y-auto">
                    {images.length > 1 && <div className="absolute inset-x-3 top-0 h-px bg-divider z-10" />}
                    <div ref={scrollRef} className="p-3 flex-row gap-2">
                        {imageColumns.map((columnImages, i) => (
                            <div key={`column-${i}`} className="flex-col gap-2 flex-1">
                                {columnImages.map(image => (
                                    <ImageItem
                                        key={image.id}
                                        image={image}
                                        height={dimensions[image.id] ? calculateImageHeight(image, dimensions) : 100}
                                        dimensionsLoaded={dimensions[image.id] ? true : false}
                                        selected={selectedImageId === image.id}
                                        onClick={() =>
                                            setSelectedImageId(selectedImageId === image.id ? null : image.id)
                                        }
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="flex-col gap-3 p-3 sticky bottom-0 bg-primary">
                        <div className="absolute top-0 inset-x-3 h-px bg-divider" />
                        <ImageButtons image={selectedImage} />
                    </div>
                </div>
            )}
        </main>
    )
}

function ImageItem({ image, height, dimensionsLoaded = false, selected = false, onClick = null }) {
    return (
        <div
            className="w-full bg-tertiary dark:bg-secondary rounded flex center relative cursor-pointer"
            style={{ height }}
            onClick={onClick}
        >
            {selected && (
                <div className="absolute -inset-[4px] border-2 border-tint rounded-[12px]">
                    <div className="bg-tint rounded-[inherit] absolute inset-0 opacity-15" />
                </div>
            )}
            {dimensionsLoaded && (
                <img
                    src={`${image.url}?scale-down-to=512`}
                    alt={image.altText}
                    className="w-full h-full object-contain relative rounded-[inherit]"
                    style={{ maxHeight: height, minHeight: 10 }}
                    draggable={false}
                />
            )}
            <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
        </div>
    )
}

function CollectionView() {
    const ref = useRef(null)

    const [collection, setCollection] = useState(null)
    const [collections, setCollections] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [collectionItems, setCollectionItems] = useState([])
    const [collectionFields, setCollectionFields] = useState([])

    useEffect(() => {
        if (framer.mode === "collection") {
            const updateCollection = async () => {
                const [collection, collections] = await Promise.all([
                    framer.getActiveCollection(),
                    framer.getCollections(),
                ])

                setCollection(collection)
                setCollections(collections)
                setIsLoading(false)
            }

            updateCollection()
        }
    }, [])

    useEffect(() => {
        const updateCollection = async () => {
            if (collection) {
                setIsLoading(true)

                collection.setAsActive()

                const [items, fields] = await Promise.all([collection.getItems(), collection.getFields()])
                setCollectionItems(items)
                setCollectionFields(fields)

                setIsLoading(false)
            }
        }

        updateCollection()
    }, [collection])

    const [rows, columns, titleColumnName] = useMemo(() => {
        const rows = []
        const columns = []
        let titleColumnName = ""

        if (!isLoading && collection && collectionFields.length > 0) {
            let titleField = null
            if (collection.slugFieldBasedOn) {
                titleField = collectionFields.find(field => field.id === collection.slugFieldBasedOn)
            }

            if (!titleField) {
                titleField = collectionFields.find(field => field.name === "Title")
            }

            if (!titleField) {
                titleField = collectionFields.find(field => field.type === "string")
            }

            if (titleField) {
                titleColumnName = titleField.name
            }

            for (const field of collectionFields) {
                if (field.type === "image") {
                    columns.push({ name: field.name, id: field.id })
                } else if (field.type === "array") {
                    const imageFields = []

                    for (const arrayField of field.fields) {
                        if (arrayField.type === "image") {
                            imageFields.push(arrayField)
                        }
                    }

                    if (imageFields.length === 1) {
                        columns.push({ name: field.name, id: imageFields[0].id })
                    } else if (imageFields.length > 1) {
                        for (const imageField of imageFields) {
                            columns.push({ name: `${field.name} -> ${imageField.name}`, id: imageField.id })
                        }
                    }
                }
            }

            for (const item of collectionItems) {
                const columnValues = {}

                for (const field of collectionFields) {
                    if (field.type === "array") {
                        const fieldData = item.fieldData[field.id]?.value

                        for (const arrayField of field.fields) {
                            const column = columns.find(c => c.id === arrayField.id)
                            if (column) {
                                const values = []

                                for (const arrayItem of fieldData) {
                                    values.push(arrayItem.fieldData?.[arrayField.id]?.value)
                                }

                                columnValues[arrayField.id] = values
                            }
                        }
                    } else {
                        const column = columns.find(c => c.id === field.id)
                        if (column) {
                            columnValues[column.id] = [item.fieldData[field.id]?.value]
                        }
                    }
                }

                rows.push({
                    id: item.id,
                    title: item.fieldData[titleField?.id]?.value,
                    columns: columnValues,
                    type: "page",
                })
            }
        }

        return [rows, columns, titleColumnName]
    }, [collection, collectionFields, collectionItems, isLoading])

    useEffect(() => {
        // Handle UI sizing when there are no image fields
        if (!isLoading && columns.length === 0) {
            framer.showUI({
                position: "top right",
                width: 300,
                height: 300,
            })
        }
    }, [isLoading, columns.length])

    return (
        <div
            ref={ref}
            className={classNames(
                "flex-col max-h-[500px] select-none",
                isLoading || columns.length === 0 ? "w-full size-full" : "w-max"
            )}
        >
            {collections.length > 1 && (
                <div className="flex-col px-3 pb-3">
                    <select
                        value={collection?.id}
                        onChange={e => setCollection(collections.find(c => c.id === e.target.value))}
                        className="w-full pl-2"
                    >
                        <option value="" disabled>
                            Select a collection...
                        </option>
                        {[...collections]
                            .sort((a, b) => {
                                if (a.readonly === b.readonly) return 0
                                return a.readonly ? 1 : -1
                            })
                            .map(collection => (
                                <option key={collection.id} value={collection.id}>
                                    {collection.name}
                                </option>
                            ))}
                    </select>
                </div>
            )}
            {isLoading ? (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Spinner />
                </div>
            ) : columns.length > 0 ? (
                <Table
                    containerRef={ref}
                    rows={rows}
                    columns={columns}
                    titleColumnName={titleColumnName}
                    isCollectionMode
                />
            ) : (
                <div className="flex-col pt-6 pb-10 center gap-1.5 px-3 w-full flex-1 text-center text-balance">
                    <div className="size-[22px] relative flex center bg-tint rounded-[4px] mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" className="text-reversed">
                            <path
                                d="M 10.838 9.29 C 10.444 8.683 9.556 8.683 9.162 9.29 L 4.504 16.455 C 4.072 17.12 4.549 18 5.343 18 L 14.657 18 C 15.451 18 15.928 17.12 15.496 16.455 Z"
                                fill="currentColor"
                            ></path>
                            <path
                                d="M 16 4 C 17.105 4 18 4.895 18 6 C 18 7.105 17.105 8 16 8 C 14.895 8 14 7.105 14 6 C 14 4.895 14.895 4 16 4 Z"
                                fill="currentColor"
                            ></path>
                        </svg>
                    </div>
                    <span className="text-primary font-semibold">No images found</span>
                    <span className="text-tertiary">This collection doesn't have any image or gallery fields.</span>
                    {collectionFields.some(field => field.type === "unsupported") && (
                        <p className="text-tertiary mt-2">
                            Due to a technical limitation, gallery fields are not currently supported.{" "}
                            <a
                                href="https://www.framer.community/c/plugin-api-requests/add-gallery-fields-support-to-cms-plugins"
                                target="_blank"
                            >
                                Learn more...
                            </a>
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

function Table({ containerRef, rows, columns, titleColumnName, isCollectionMode = false }) {
    const [activeSelection, setActiveSelection] = useState({ nodeId: null, imageId: null })
    const [activeImageElement, setActiveImageElement] = useState(null)

    const ref = useRef(null)

    // Find the active image from the rows based on the stored IDs
    const activeImage = useMemo(() => {
        if (!activeSelection.nodeId || !activeSelection.imageId) return null
        const row = rows.find(r => r.id === activeSelection.nodeId)
        if (!row) return null

        for (const column of columns) {
            const images = row.columns?.[column.id]
            if (Array.isArray(images)) {
                const image = images.find(img => img && img.id === activeSelection.imageId)
                if (image) return image
            }
        }
        return null
    }, [rows, columns, activeSelection])

    function changeActiveImage(image, element, nodeId) {
        if (!image) return

        const isSelecting = image.id !== activeSelection.imageId || nodeId !== activeSelection.nodeId
        if (isSelecting) {
            setActiveSelection({ nodeId, imageId: image.id })
            setActiveImageElement(element)
        } else {
            setActiveSelection({ nodeId: null, imageId: null })
            setActiveImageElement(null)
        }
    }

    useEffect(() => {
        const elementRef = containerRef ?? ref
        if (!elementRef.current) return

        const updateSize = () => {
            if (!elementRef.current) return

            framer.showUI({
                position: "top right",
                width: Math.max(Math.min(elementRef.current.offsetWidth, 600), 280),
                height: Math.max(Math.min(elementRef.current.offsetHeight, 500), 158),
            })
        }

        // Initial size update
        updateSize()

        // Set up resize observer
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(elementRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [rows, activeImage, activeImageElement])

    // Add keyboard event listener for Escape key
    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === "Escape" && activeImage) {
                setActiveSelection({ nodeId: null, imageId: null })
                setActiveImageElement(null)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeImage])

    return (
        <div ref={ref} className="overflow-auto flex-col select-none relative w-max">
            <div className="flex-col w-max min-w-[260px] relative">
                <div className="sticky top-0 h-px bg-divider mx-3" />
                <table>
                    <thead className="h-10 text-left">
                        <tr className="relative">
                            <TableHeading className="min-w-[100px] pl-3">{titleColumnName}</TableHeading>
                            {columns.map(column => (
                                <TableHeading key={column.id} className="pr-3">
                                    {column.name}
                                </TableHeading>
                            ))}
                            <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                row={row}
                                columns={columns}
                                isLastRow={index === rows.length - 1}
                                isCollectionMode={isCollectionMode}
                                activeImage={activeImage}
                                changeActiveImage={changeActiveImage}
                            />
                        ))}
                    </tbody>
                </table>
                <div className="flex-col gap-3 p-3 sticky bottom-0 bg-primary">
                    <div className="absolute inset-x-3 top-0 h-px bg-divider" />
                    <ImageButtons image={activeImage} />
                </div>
            </div>
        </div>
    )
}

function TableHeading({ children, className }) {
    return <th className={classNames("text-tertiary font-medium", className)}>{children}</th>
}

function TableRow({ row, columns, isLastRow = false, isCollectionMode = false, activeImage, changeActiveImage }) {
    const imageElements = useRef([])

    const includesActiveImage = useMemo(() => {
        return columns.some(column => {
            return Array.isArray(row.columns?.[column.id]) && row.columns[column.id].includes(activeImage)
        })
    }, [row, columns, activeImage])

    const handleTitleClick = () => {
        // Find the first column that has images
        for (const column of columns) {
            const images = row.columns?.[column.id]
            if (Array.isArray(images) && images.length > 0) {
                // Get the first image and its corresponding element
                const firstImage = images[0]
                const elementIndex = imageElements.current.findIndex(el => el !== null)
                if (elementIndex !== -1) {
                    changeActiveImage(firstImage, imageElements.current[elementIndex], row.id)
                }
                break
            }
        }
    }

    return (
        <tr
            className={classNames(
                "text-secondary group hover:text-primary font-medium px-3 relative",
                includesActiveImage && "bg-[#FCFCFC] dark:bg-[#161616]"
            )}
        >
            <td
                className={classNames(
                    "text-nowrap px-3 cursor-pointer flex-col items-start",
                    isCollectionMode ? "min-w-[250px] max-w-[300px]" : "max-w-[200px]"
                )}
                onClick={handleTitleClick}
            >
                <div className="flex-row gap-2.5 items-center overflow-hidden h-10 w-full">
                    <span className={classNames("truncate", includesActiveImage && "text-primary")} title={row.title}>
                        {row.title}
                    </span>
                </div>
                {!isLastRow && <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />}
            </td>
            {columns.map((column, columnIndex) => (
                <td key={`${row.id}-${column.id}-${columnIndex}`} className="align-top">
                    <div className="flex-row gap-1 pr-3 flex-wrap max-w-[185px] py-[10px]">
                        {Array.isArray(row.columns?.[column.id])
                            ? row.columns[column.id].map((image, index) => (
                                  <div
                                      key={`${row.id}-${image ? image.id : "empty"}-${index}`}
                                      className={classNames("flex-col center shrink-0 w-10", image && "cursor-pointer")}
                                      ref={el => (imageElements.current[index] = el)}
                                      onClick={() => changeActiveImage(image, imageElements.current[index], row.id)}
                                  >
                                      <div className="w-full h-[30px] relative rounded-sm bg-secondary transition-transform">
                                          {image && (
                                              <>
                                                  {activeImage === image && (
                                                      <div className="absolute -inset-[3px] border-[1.5px] border-tint rounded">
                                                          <div className="bg-tint rounded-[inherit] absolute inset-0 opacity-15" />
                                                      </div>
                                                  )}
                                                  <img
                                                      src={`${image.url}?scale-down-to=512`}
                                                      alt={image.altText}
                                                      className="size-full object-cover rounded-[inherit] relative"
                                                      draggable={false}
                                                  />
                                                  <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
                                              </>
                                          )}
                                      </div>
                                  </div>
                              ))
                            : null}
                    </div>
                </td>
            ))}
        </tr>
    )
}

function ImageButtons({ image, onButtonClick = null }) {
    const [isDownloading, setIsDownloading] = useState(false)
    const [isCopying, setIsCopying] = useState(false)
    const [isCopyingUrl, setIsCopyingUrl] = useState(false)

    const hasImage = image ? true : false

    async function onCopyImageClick() {
        if (!image) return

        setIsCopying(true)

        try {
            // Fetch the image as a blob
            const response = await fetch(image.url)
            const blob = await response.blob()

            // Handle SVG separately by copying as text
            if (blob.type === "image/svg+xml") {
                const text = await blob.text()
                await navigator.clipboard.writeText(text)
                framer.notify("SVG copied to clipboard!", { variant: "success" })
                setIsCopying(false)
                if (onButtonClick) onButtonClick()
                return
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
        } catch (err) {
            console.error(err)
            framer.notify("Failed to copy image", { variant: "error" })
        }

        setIsCopying(false)

        if (onButtonClick) onButtonClick()
    }

    function onCopyImageUrlClick() {
        if (!image) return

        setIsCopyingUrl(true)

        const success = copyToClipboard(image.url)
        if (success) {
            framer.notify("Image URL copied to clipboard!", { variant: "success" })
        } else {
            framer.notify("Failed to copy image URL", { variant: "error" })
        }

        setIsCopyingUrl(false)

        if (onButtonClick) onButtonClick()
    }

    function onDownloadImageClick() {
        if (!image) return

        setIsDownloading(true)

        const success = downloadFile(image.url, image.id)
        if (success) {
            framer.notify("Image downloaded!", { variant: "success" })
        } else {
            framer.notify("Failed to download image", { variant: "error" })
        }

        setIsDownloading(false)

        if (onButtonClick) onButtonClick()
    }

    return (
        <div className={classNames("flex-col gap-2 w-full", !hasImage && "opacity-50 pointer-events-none")}>
            <div className="flex-row gap-2 flex-1">
                <button onClick={onCopyImageClick} className="flex-1">
                    {isCopying ? <Spinner /> : "Copy Image"}
                </button>
                <button onClick={onCopyImageUrlClick} className="flex-1">
                    {isCopyingUrl ? <Spinner /> : "Copy URL"}
                </button>
            </div>
            <button onClick={onDownloadImageClick} className="framer-button-primary">
                {isDownloading ? <Spinner /> : "Download"}
            </button>
        </div>
    )
}

function Spinner() {
    return <div className="framer-spinner" />
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

function useImageDimensions(images) {
    const [dimensions, setDimensions] = useState({})

    useEffect(() => {
        let isMounted = true
        const newDimensions = {}

        const promises = images.map(image => {
            return new Promise(resolve => {
                if (image && image.width && image.height) {
                    newDimensions[image.id] = { width: image.width, height: image.height }
                    resolve()
                } else if (image && image.url) {
                    const img = new window.Image()
                    img.onload = () => {
                        newDimensions[image.id] = { width: img.naturalWidth, height: img.naturalHeight }
                        resolve()
                    }
                    img.onerror = () => resolve()
                    img.src = image.url
                } else {
                    resolve()
                }
            })
        })

        Promise.all(promises).then(() => {
            if (isMounted) setDimensions(newDimensions)
        })

        return () => {
            isMounted = false
        }
    }, [images])

    return dimensions
}

function calculateImageHeight(image, dimensions) {
    const dim = dimensions[image.id]
    if (dim && dim.width && dim.height) {
        return (COLUMN_WIDTH * dim.height) / dim.width
    }
    // fallback
    const defaultAspectRatio = 4 / 3
    return COLUMN_WIDTH / defaultAspectRatio
}

function getImageAssets(object, level = 0) {
    if (!object) return []

    // Prevent infinite recursion
    if (level > 5) return []

    const imageAssets = []

    if (isImageAsset(object)) {
        imageAssets.push(object)
    } else if (Array.isArray(object)) {
        for (const item of object) {
            if (typeof item === "object") {
                imageAssets.push(...getImageAssets(item, level + 1))
            }
        }
    } else if (typeof object === "object") {
        for (const key in object) {
            if (typeof object[key] === "object") {
                imageAssets.push(...getImageAssets(object[key], level + 1))
            }
        }
    }

    return imageAssets
}
