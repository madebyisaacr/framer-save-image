import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo, useRef } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"
import classNames from "classnames"

export function App() {
    const selection = useSelection()
    const image = useImage()

    const rows = useMemo(() => {
        const rows = []

        for (const node of selection) {
            let nodeImages = []
            let type = "image"

            if (isFrameNode(node)) {
                if (isImageAsset(node.backgroundImage)) {
                    nodeImages.push(node.backgroundImage)
                }
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
                rows.push({
                    id: node.id,
                    title: node.name,
                    columns: { Images: nodeImages },
                    type,
                })
            }
        }

        return rows
    }, [selection])

    const singleImage =
        image ||
        (rows.length === 1 ? (rows[0].columns?.Images?.length === 1 ? rows[0].columns?.Images[0] : null) : null)

    return framer.mode === "collection" ? (
        <CollectionTable />
    ) : singleImage ? (
        <SingleImageView image={singleImage} />
    ) : rows.length > 0 ? (
        <Table rows={rows} columns={["Images"]} titleColumnName="Name" />
    ) : (
        <SingleImageView />
    )
}

function SingleImageView({ image }) {
    useEffect(() => {
        framer.showUI({
            position: "top right",
            width: 260,
            height: 300,
        })
    }, [])

    return (
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden select-none">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img
                        src={`${image.url}?scale-down-to=512`}
                        alt={image.altText}
                        className="size-full object-contain"
                        draggable={false}
                    />
                ) : (
                    <span className="text-tertiary">Select an image</span>
                )}
            </div>
            <ImageButtons image={image} />
        </main>
    )
}

function CollectionTable() {
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
                    columns.push(field.name)
                }
            }

            for (const item of collectionItems) {
                const columnValues = {}

                for (const field of collectionFields) {
                    if (columns.indexOf(field.name) !== -1) {
                        columnValues[field.name] = [item.fieldData[field.id]?.value]
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
            className={classNames("flex-col", isLoading || columns.length === 0 ? "w-full size-full" : "min-w-max")}
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
                        {collections.map(collection => (
                            <option key={collection.id} value={collection.id}>
                                {collection.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {isLoading ? (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="framer-spinner" />
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
                <div className="flex-col pt-6 pb-10 center gap-1 px-3 w-full flex-1 text-center text-balance">
                    <span className="text-primary font-semibold">No image fields found</span>
                    <span className="text-tertiary">This collection doesn't have any image fields.</span>
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

        for (const columnName of columns) {
            const images = row.columns?.[columnName]
            if (Array.isArray(images)) {
                const image = images.find(img => img.id === activeSelection.imageId)
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
                width: Math.max(Math.min(elementRef.current.offsetWidth, 600), 260),
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
        <div ref={ref} className="overflow-auto flex-col select-none relative min-w-max">
            <div className="flex-col pb-3 min-w-max">
                <table>
                    <thead className="h-10 text-left">
                        <tr className="relative">
                            <TableHeading className="min-w-[100px] pl-3">{titleColumnName}</TableHeading>
                            {columns.map(column => (
                                <TableHeading key={column} className="pr-3">
                                    {column}
                                </TableHeading>
                            ))}
                            <div className="absolute inset-x-3 top-0 h-px bg-divider" />
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
                <div className="flex-col gap-3 px-3">
                    <div className="w-full h-px bg-divider shrink-0" />
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
        return columns.some(columnName => {
            return Array.isArray(row.columns?.[columnName]) && row.columns[columnName].includes(activeImage)
        })
    }, [row, columns, activeImage])

    const handleTitleClick = () => {
        // Find the first column that has images
        for (const columnName of columns) {
            const images = row.columns?.[columnName]
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
                "h-10 text-secondary group hover:text-primary font-medium px-3 relative",
                includesActiveImage && "text-primary bg-[#FCFCFC]"
            )}
        >
            <td
                className={classNames(
                    "text-nowrap px-3 items-center cursor-pointer",
                    isCollectionMode ? "min-w-[250px] max-w-[300px]" : "max-w-[200px]"
                )}
                onClick={handleTitleClick}
            >
                <div className="flex-row gap-2.5 items-center overflow-hidden">
                    <Icon type={row.type} active={includesActiveImage} />
                    <span className="truncate">{row.title}</span>
                </div>
                {!isLastRow && <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />}
            </td>
            {columns.map((columnName, columnIndex) => (
                <td>
                    <div className="flex-row gap-2 h-10 pr-3">
                        {Array.isArray(row.columns?.[columnName])
                            ? row.columns[columnName].map((image, index) => (
                                  <div
                                      className={classNames("flex-col center h-full shrink-0 cursor-pointer", "w-10")}
                                      ref={el => (imageElements.current[index] = el)}
                                      onClick={() => changeActiveImage(image, imageElements.current[index], row.id)}
                                  >
                                      <div
                                          className={classNames(
                                              "w-full h-[22px] relative rounded-[4px] bg-secondary transition-transform"
                                          )}
                                      >
                                          {image && (
                                              <>
                                                  {activeImage === image && (
                                                      <div className="absolute -inset-[3px] border border-tint rounded-[7px]">
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

function ImageButtons({ image, row = false, onButtonClick = null }) {
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

        if (onButtonClick) onButtonClick()
    }

    function onCopyImageUrlClick() {
        if (!image) return

        const success = copyToClipboard(image.url)
        if (success) {
            framer.notify("Image URL copied to clipboard!", { variant: "success" })
        } else {
            framer.notify("Failed to copy image URL", { variant: "error" })
        }

        if (onButtonClick) onButtonClick()
    }

    function onDownloadImageClick() {
        if (!image) return

        const success = downloadFile(image.url, image.id)
        if (success) {
            framer.notify("Image downloaded!", { variant: "success" })
        } else {
            framer.notify("Failed to download image", { variant: "error" })
        }

        if (onButtonClick) onButtonClick()
    }

    return row ? (
        <div className="flex-row gap-2 w-full">
            <button disabled={!hasImage} onClick={onCopyImageClick} className="w-fit px-2.5">
                Copy Image
            </button>
            <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="w-fit px-2.5">
                Copy URL
            </button>
            <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary w-fit px-2.5">
                Download
            </button>
        </div>
    ) : (
        <div className="flex-col gap-2 w-full">
            <div className="flex-row gap-2 flex-1">
                <button disabled={!hasImage} onClick={onCopyImageClick} className="flex-1">
                    Copy Image
                </button>
                <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="flex-1">
                    Copy URL
                </button>
            </div>
            <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary">
                Download
            </button>
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

function Icon({ type = "image", active = false }) {
    return (
        <div
            className={classNames(
                "text-tertiary group-hover:text-primary transition-colors shrink-0",
                active && "text-primary"
            )}
        >
            {type === "page" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                    <path
                        d="M 1 2.5 C 1 1.119 2.119 0 3.5 0 L 5 0 C 5.552 0 6 0.448 6 1 L 6 3 C 6 4.105 6.895 5 8 5 L 10 5 C 10.552 5 11 5.448 11 6 L 11 9.5 C 11 10.881 9.881 12 8.5 12 L 3.5 12 C 2.119 12 1 10.881 1 9.5 Z M 7.427 0.427 C 7.269 0.269 7 0.381 7 0.604 L 7 3 C 7 3.552 7.448 4 8 4 L 10.396 4 C 10.619 4 10.731 3.731 10.573 3.573 Z"
                        fill="currentColor"
                    ></path>
                </svg>
            ) : type === "component" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                    <path
                        d="M 11.439 4.939 C 12.025 5.525 12.025 6.475 11.439 7.061 L 9.957 8.543 C 9.762 8.738 9.445 8.738 9.25 8.543 L 7.061 6.354 C 6.865 6.158 6.865 5.842 7.061 5.646 L 9.25 3.457 C 9.445 3.262 9.762 3.262 9.957 3.457 Z M 3.457 2.75 C 3.262 2.555 3.262 2.238 3.457 2.043 L 4.939 0.561 C 5.525 -0.025 6.475 -0.025 7.061 0.561 L 8.543 2.043 C 8.738 2.238 8.738 2.555 8.543 2.75 L 6.354 4.939 C 6.158 5.135 5.842 5.135 5.646 4.939 Z M 7.061 11.439 C 6.475 12.025 5.525 12.025 4.939 11.439 L 3.457 9.957 C 3.262 9.762 3.262 9.445 3.457 9.25 L 5.646 7.061 C 5.842 6.865 6.158 6.865 6.354 7.061 L 8.543 9.25 C 8.738 9.445 8.738 9.762 8.543 9.957 Z M 0.561 7.061 C -0.025 6.475 -0.025 5.525 0.561 4.939 L 2.043 3.457 C 2.238 3.262 2.555 3.262 2.75 3.457 L 4.939 5.646 C 5.135 5.842 5.135 6.158 4.939 6.354 L 2.75 8.543 C 2.555 8.738 2.238 8.738 2.043 8.543 Z"
                        fill="currentColor"
                    ></path>
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                    <path
                        d="M 1 3 C 1 1.895 1.895 1 3 1 L 9 1 C 10.105 1 11 1.895 11 3 L 11 9 C 11 10.105 10.105 11 9 11 L 3 11 C 1.895 11 1 10.105 1 9 Z"
                        fill="currentColor"
                    ></path>
                </svg>
            )}
        </div>
    )
}
