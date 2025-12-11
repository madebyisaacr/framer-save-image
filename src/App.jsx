import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react"
import "./App.css"
import { imageContextMenu } from "./imageUtils"
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

    const { images, imageLayerIds } = useMemo(() => {
        if (framer.mode === "editImage") {
            return {
                images: image ? [image] : [],
                imageLayerIds: {},
            }
        } else {
            const allImages = []
            const layerIdsMap = new Map()

            for (const node of selection) {
                if (isFrameNode(node)) {
                    if (isImageAsset(node.backgroundImage)) {
                        allImages.push(node.backgroundImage)
                        const imageId = node.backgroundImage.id
                        if (imageId) {
                            if (!layerIdsMap.has(imageId)) {
                                layerIdsMap.set(imageId, new Set())
                            }
                            layerIdsMap.get(imageId).add(node.id)
                        }
                    }
                } else if (isComponentInstanceNode(node)) {
                    const imageAssets = getImageAssets(node.controls)
                    for (const img of imageAssets) {
                        allImages.push(img)
                        const imageId = img.id
                        if (imageId) {
                            if (!layerIdsMap.has(imageId)) {
                                layerIdsMap.set(imageId, new Set())
                            }
                            layerIdsMap.get(imageId).add(node.id)
                        }
                    }
                }
            }

            const uniqueImages = []
            const imageLayerIds = {}

            if (allImages.length > 0) {
                // Remove duplicate images by id (or by reference if no id)
                const seen = new Set()
                for (const img of allImages) {
                    const key = img && img.id ? img.id : img
                    if (!seen.has(key)) {
                        seen.add(key)
                        uniqueImages.push(img)

                        // Convert Set to Array for the final object
                        if (img && img.id && layerIdsMap.has(img.id)) {
                            imageLayerIds[img.id] = Array.from(layerIdsMap.get(img.id))
                        }
                    }
                }
            }

            // Limit to 100 images
            return {
                images: uniqueImages.slice(0, MAX_IMAGES_CANVAS),
                imageLayerIds,
            }
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

    const onSingleImageContextMenu = event => {
        event.preventDefault()
        imageContextMenu(event, images[0])
    }

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
                        <div
                            onContextMenu={onSingleImageContextMenu}
                            className="w-full bg-tertiary dark:bg-secondary rounded flex center relative overflow-hidden"
                        >
                            <Checkerboard />
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
                                        layerIds={imageLayerIds[image.id] || []}
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

function ImageItem({ image, layerIds = [], height, dimensionsLoaded = false, selected = false, onClick = null }) {
    const onContextMenu = event => {
        event.preventDefault()

        if (layerIds.length === 0) return

        imageContextMenu(event, image, [
            {
                label: layerIds.length === 1 ? "Select Layer" : `Select ${layerIds.length} Layers`,
                onAction: () => {
                    framer.setSelection(layerIds)
                },
            },
            { type: "separator" },
        ])
    }

    return (
        <div
            className="w-full bg-tertiary dark:bg-secondary rounded flex center relative cursor-pointer"
            style={{ height }}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            <Checkerboard />
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

function Checkerboard({ halfScale = false }) {
    return (
        <div
            className="absolute inset-0 rounded-[inherit]"
            style={{ backgroundImage: `url("/checkerboard.svg")`, backgroundSize: halfScale ? "15px" : "30px" }}
        />
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

    // Check if any rows have images
    const hasAnyImages = useMemo(() => {
        return rows.some(row => {
            return columns.some(column => {
                const images = row.columns?.[column.id]
                return Array.isArray(images) && images.some(img => img !== null && img !== undefined)
            })
        })
    }, [rows, columns])

    useLayoutEffect(() => {
        // Handle UI sizing when there are no image fields or no images in items
        if (!isLoading && (columns.length === 0 || !hasAnyImages)) {
            framer.showUI({
                position: "top right",
                width: 300,
                height: 300,
            })
        }
    }, [isLoading, columns.length, hasAnyImages])

    return (
        <div
            ref={ref}
            className={classNames(
                "flex-col max-h-[500px] select-none overflow-hidden",
                isLoading || columns.length === 0 || !hasAnyImages ? "size-full" : "w-full"
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
            ) : columns.length > 0 && hasAnyImages ? (
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
                    <span className="text-tertiary">
                        {columns.length === 0
                            ? "This collection doesn't have any image or gallery fields."
                            : "No items in this collection have any images."}
                    </span>
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
        if (
            !activeSelection.nodeId ||
            !activeSelection.imageId ||
            activeSelection.columnIndex === null ||
            activeSelection.columnIndex === undefined
        )
            return null

        const row = rows.find(r => r.id === activeSelection.nodeId)
        if (!row) return null

        const column = columns[activeSelection.columnIndex]
        if (!column) return null

        const images = row.columns?.[column.id]
        if (Array.isArray(images)) {
            const image = images.find(img => img && img.id === activeSelection.imageId)
            if (image) return image
        }
        return null
    }, [rows, columns, activeSelection])

    function changeActiveImage(image, element, nodeId, columnIndex = null) {
        if (!image) return

        const isSelecting =
            image.id !== activeSelection.imageId ||
            nodeId !== activeSelection.nodeId ||
            columnIndex !== activeSelection.columnIndex

        if (isSelecting) {
            setActiveSelection({ nodeId, imageId: image.id, columnIndex })
            setActiveImageElement(element)
        } else {
            setActiveSelection({ nodeId: null, imageId: null, columnIndex: null })
            setActiveImageElement(null)
        }
    }

    // Calculate deterministic width based on column content
    const [pluginWidth, columnWidths] = useMemo(() => {
        const NAME_COLUMN_WIDTH = 250
        const MAX_PLUGIN_WIDTH = 600
        const IMAGE_WIDTH = 50
        const IMAGE_GAP = 5
        const COLUMN_PADDING = 15

        // Calculate width for each column based on max images in any cell
        let totalColumnWidth = NAME_COLUMN_WIDTH
        const columnWidths = []

        for (const column of columns) {
            // Find the maximum number of images in any cell in this column
            let maxImagesInColumn = 0
            for (const row of rows) {
                const images = row.columns?.[column.id]
                if (Array.isArray(images)) {
                    const imageCount = images.filter(img => img !== null && img !== undefined).length
                    maxImagesInColumn = Math.max(maxImagesInColumn, imageCount)
                }
            }

            // Cap at 3 images for width calculation
            const effectiveImageCount = Math.min(maxImagesInColumn, 3)

            // Calculate column width: N images * 30px + (N-1) gaps * 5px + 15px padding
            const columnWidth =
                effectiveImageCount > 0
                    ? Math.max(
                          65,
                          effectiveImageCount * IMAGE_WIDTH + (effectiveImageCount - 1) * IMAGE_GAP + COLUMN_PADDING
                      )
                    : 65 // Default to 100 if no images

            columnWidths.push(columnWidth)
            totalColumnWidth += columnWidth
        }

        return [Math.min(totalColumnWidth, MAX_PLUGIN_WIDTH), columnWidths]
    }, [rows, columns])

    useLayoutEffect(() => {
        const elementRef = containerRef ?? ref
        if (!elementRef.current) return

        const updateSize = () => {
            if (!elementRef.current) return

            framer.showUI({
                position: "top right",
                width: pluginWidth,
                height: Math.max(Math.min(elementRef.current.offsetHeight, 500), 158),
            })
        }

        // Initial size update
        updateSize()

        // Set up resize observer for height only
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(elementRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [rows, activeImage, activeImageElement, pluginWidth])

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
        <div ref={ref} className="overflow-y-auto overflow-x-hidden flex-col select-none relative w-full">
            <div className="flex-col w-full relative">
                <div className="sticky top-0 h-px bg-divider mx-3" />
                <div className="w-full overflow-x-auto">
                    <table>
                        <thead className="h-10 text-left">
                            <tr className="relative">
                                <TableHeading className="min-w-[100px] pl-3">{titleColumnName}</TableHeading>
                                {columns.map((column, columnIndex) => (
                                    <TableHeading
                                        key={column.id}
                                        className="pr-3"
                                        width={columnWidths[columnIndex] || 65}
                                    >
                                        {column.name}
                                    </TableHeading>
                                ))}
                                <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows
                                .filter(row => {
                                    // Hide rows that don't have any images
                                    return columns.some(column => {
                                        const images = row.columns?.[column.id]
                                        return (
                                            Array.isArray(images) &&
                                            images.some(img => img !== null && img !== undefined)
                                        )
                                    })
                                })
                                .map((row, index, filteredArray) => (
                                    <TableRow
                                        key={row.id}
                                        row={row}
                                        itemId={row.id}
                                        columns={columns}
                                        columnWidths={columnWidths}
                                        isLastRow={index === filteredArray.length - 1}
                                        isCollectionMode={isCollectionMode}
                                        activeImage={activeImage}
                                        activeColumnIndex={activeSelection.columnIndex}
                                        changeActiveImage={changeActiveImage}
                                    />
                                ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex-col gap-3 p-3 sticky bottom-0 bg-primary">
                    <div className="absolute inset-x-3 top-0 h-px bg-divider" />
                    <ImageButtons image={activeImage} horizontal />
                </div>
            </div>
        </div>
    )
}

function TableHeading({ children, className, width }) {
    return (
        <th
            className={classNames("text-tertiary font-medium overflow-ellipsis overflow-hidden text-nowrap", className)}
            style={{ width: width, minWidth: width, maxWidth: width }}
        >
            {children}
        </th>
    )
}

function TableRow({
    row,
    itemId,
    columns,
    columnWidths,
    isLastRow = false,
    activeImage,
    activeColumnIndex,
    changeActiveImage,
}) {
    const imageElements = useRef([])

    const includesActiveImage = useMemo(() => {
        if (
            typeof activeColumnIndex === "number" &&
            columns[activeColumnIndex] &&
            Array.isArray(row.columns?.[columns[activeColumnIndex].id])
        ) {
            return row.columns[columns[activeColumnIndex].id].includes(activeImage)
        }
        return false
    }, [row, columns, activeImage, activeColumnIndex])

    const handleTitleClick = () => {
        // Find the first column that has images
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i]
            const images = row.columns?.[column.id]
            if (Array.isArray(images) && images.length > 0) {
                // Get the first image and its corresponding element
                const firstImage = images[0]
                const elementIndex = imageElements.current.findIndex(el => el !== null)
                if (elementIndex !== -1) {
                    changeActiveImage(firstImage, imageElements.current[elementIndex], row.id, i)
                }
                break
            }
        }
    }

    const onContextMenu = (event, columnId, imageIndex) => {
        event.preventDefault()
        event.stopPropagation()

        const image = row.columns?.[columnId]?.[imageIndex]
        if (!image) return

        imageContextMenu(event, image)
    }

    return (
        <tr
            className={classNames(
                "text-secondary group hover:text-primary font-medium px-3 relative",
                includesActiveImage && "bg-[#FCFCFC] dark:bg-[#161616]"
            )}
        >
            <td className="text-nowrap px-3 cursor-pointer flex-col items-start w-[250px]" onClick={handleTitleClick}>
                <div className="flex-row gap-2.5 items-center overflow-hidden h-10 w-full">
                    <span className={classNames("truncate", includesActiveImage && "text-primary")} title={row.title}>
                        {row.title}
                    </span>
                </div>
                {!isLastRow && <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />}
            </td>
            {columns.map((column, columnIndex) => (
                <td key={`${row.id}-${column.id}-${columnIndex}`} className="align-top">
                    <div
                        className="flex-row gap-1 pr-3 flex-wrap py-2"
                        style={{
                            width: columnWidths[columnIndex] || 65,
                            minWidth: columnWidths[columnIndex] || 65,
                            maxWidth: columnWidths[columnIndex] || 65,
                        }}
                    >
                        {Array.isArray(row.columns?.[column.id])
                            ? row.columns[column.id].map((image, index) => (
                                  <div
                                      key={`${row.id}-${image ? image.id : "empty"}-${index}`}
                                      className={classNames("flex-col center shrink-0 w-10", image && "cursor-pointer")}
                                      ref={el => (imageElements.current[index] = el)}
                                      onClick={() =>
                                          changeActiveImage(image, imageElements.current[index], row.id, columnIndex)
                                      }
                                      onContextMenu={event => onContextMenu(event, column.id, index)}
                                  >
                                      <div className="w-full h-[30px] relative rounded-sm bg-secondary transition-transform">
                                          {image && (
                                              <>
                                                  <Checkerboard halfScale />
                                                  {activeImage === image && activeColumnIndex === columnIndex && (
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

function ImageButtons({ image, horizontal = false, onButtonClick = null }) {
    const [isDownloading, setIsDownloading] = useState(false)
    const [isCopying, setIsCopying] = useState(false)
    const [isCopyingUrl, setIsCopyingUrl] = useState(false)

    const hasImage = image ? true : false

    async function onCopyImageClick() {
        if (!image) return

        setIsCopying(true)
        await copyImage(image)
        setIsCopying(false)

        if (onButtonClick) {
            onButtonClick()
        }
    }

    async function onCopyImageUrlClick() {
        if (!image) return

        setIsCopyingUrl(true)
        await copyImageUrlToClipboard(image.url)
        setIsCopyingUrl(false)

        if (onButtonClick) {
            onButtonClick()
        }
    }

    async function onDownloadImageClick() {
        if (!image) return

        setIsDownloading(true)
        await downloadImage(image)
        setIsDownloading(false)

        if (onButtonClick) onButtonClick()
    }

    return (
        <div
            className={classNames(
                "gap-2 w-full",
                horizontal ? "flex-row" : "flex-col",
                !hasImage && "opacity-50 pointer-events-none"
            )}
        >
            <div className={classNames("gap-2 flex-1", horizontal ? "contents" : "flex-row")}>
                <button onClick={onCopyImageClick} className="flex-1">
                    {isCopying ? <Spinner /> : "Copy Image"}
                </button>
                <button onClick={onCopyImageUrlClick} className="flex-1">
                    {isCopyingUrl ? <Spinner /> : "Copy URL"}
                </button>
            </div>
            <button onClick={onDownloadImageClick} className="framer-button-primary flex-1 min-h-[30px]">
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
