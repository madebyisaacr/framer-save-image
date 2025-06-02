import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo, useRef } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"
import classNames from "classnames"

export function App() {
    const selection = useSelection()
    const image = useImage()
    const [collection, setCollection] = useState(null)
    const [collectionItems, setCollectionItems] = useState([])
    const [collectionFields, setCollectionFields] = useState([])

    const [rows, columns, titleColumnName] = useMemo(() => {
        const rows = []
        const columns = []
        let titleColumnName = ""

        if (framer.mode === "collection") {
            if (collection && collectionFields.length > 0) {
                let titleField = null
                if (collection.slugFieldBasedOn) {
                    titleField = collectionFields.find(field => field.id === collection.slugFieldBasedOn)
                } else {
                    titleField = collectionFields.find(field => field.name === "Title")
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
                        title: item.fieldData[titleField.id]?.value,
                        columns: columnValues,
                    })
                }
            }
        } else {
            titleColumnName = "Name"
            columns.push("Images")

            for (const node of selection) {
                let nodeImages = []
                let type = "frame"

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
        }

        return [rows, columns, titleColumnName]
    }, [selection, collection])

    useEffect(() => {
        if (framer.mode === "collection") {
            const updateCollection = async () => {
                const collection = await framer.getActiveCollection()
                const [items, fields] = await Promise.all([collection.getItems(), collection.getFields()])

                setCollection(collection)
                setCollectionItems(items)
                setCollectionFields(fields)
            }

            updateCollection()
        }
    }, [])

    return framer.mode === "collection" ? (
        <Table rows={rows} columns={columns} titleColumnName={titleColumnName} />
    ) : image ? (
        <SingleImageView image={image} />
    ) : rows.length > 0 ? (
        <Table rows={rows} columns={columns} titleColumnName={titleColumnName} />
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
                    <img src={image.url} alt={image.altText} className="size-full object-contain" draggable={false} />
                ) : (
                    <span className="text-tertiary">Select an image</span>
                )}
            </div>
            <ImageButtons image={image} />
        </main>
    )
}

function Table({ rows, columns, titleColumnName }) {
    const tableRef = useRef(null)
    const popupContainerRef = useRef(null)
    const popupRef = useRef(null)
    const popupArrowRef = useRef(null)

    const [activeImage, setActiveImage] = useState(null)
    const [activeImageElement, setActiveImageElement] = useState(null)

    const flattenedRowImages = useMemo(() => {
        return Array.isArray(rows)
            ? rows.map(row => {
                  const images = []

                  for (const columnName of Object.keys(row.columns)) {
                      if (Array.isArray(row.columns[columnName])) {
                          images.push(...row.columns[columnName])
                      }
                  }

                  return images
              })
            : []
    }, [rows])

    const activeImageIndex = activeImage ? flattenedRowImages.findIndex(row => row.includes(activeImage)) : -1
    const isArrowAbove = activeImage ? (rows.length === 1 ? true : activeImageIndex !== rows.length - 1) : true

    function changeActiveImage(image, element) {
        const isSelecting = image !== activeImage
        if (isSelecting) {
            setActiveImage(image)
            setActiveImageElement(element)
        } else {
            setActiveImage(null)
            setActiveImageElement(null)
        }
    }

    useEffect(() => {
        if (!tableRef.current) return

        const updateSize = () => {
            if (!tableRef.current) return

            // if (framer.mode === "collection") {
            //     framer.showUI({
            //         width: 600,
            //         height: 500,
            //     })
            // } else {
            framer.showUI({
                position: "top right",
                width: Math.max(Math.min(tableRef.current.offsetWidth, 600), 260),
                height: Math.max(Math.min(tableRef.current.offsetHeight, 500), 158),
            })
            // }

            if (activeImage) {
                const rect = activeImageElement.getBoundingClientRect()
                const centerOfImage = rect.left + rect.width / 2
                const centerFromRight = window.innerWidth - centerOfImage
                const popupWidth = popupRef.current.offsetWidth
                const paddingRight = centerFromRight - popupWidth / 2
                const bottom = isArrowAbove ? Math.max(window.innerHeight - rect.top - 48 - 50, 8) : 0

                popupContainerRef.current.style.paddingBottom = `${bottom}px`
                popupContainerRef.current.style.paddingRight = `${Math.max(paddingRight, 8)}px`
                popupArrowRef.current.style.right = `${centerFromRight}px`
            }
        }

        // Initial size update
        updateSize()

        // Set up resize observer
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(tableRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [activeImage, activeImageElement])

    // Add keyboard event listener for Escape key
    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === "Escape" && activeImage) {
                setActiveImage(null)
                setActiveImageElement(null)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeImage])

    return (
        <div className="overflow-auto h-full flex-col select-none relative">
            <div ref={tableRef} className="flex-col gap-1 px-3 pb-px w-max">
                <table>
                    <thead className="h-10 text-left">
                        <tr className="border-b border-t border-divider">
                            <TableHeading className="min-w-[100px]">{titleColumnName}</TableHeading>
                            {columns.map((column, index) => (
                                <TableHeading key={column}>{column}</TableHeading>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                row={row}
                                columns={columns}
                                isLastRow={index === rows.length - 1}
                                activeImage={activeImage}
                                changeActiveImage={changeActiveImage}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {activeImage && (
                <div
                    ref={popupContainerRef}
                    className={classNames(
                        "absolute inset-x-0 flex-row justify-end pointer-events-none",
                        isArrowAbove ? "bottom-0" : "bottom-[48px]"
                    )}
                >
                    <div
                        ref={popupRef}
                        className="flex-col gap-2 bg-modal rounded-xl p-2 max-w-fit flex-1 pointer-events-auto"
                        style={{
                            boxShadow: "rgba(0, 0, 0, 0.1) 0px 10px 30px 0px",
                        }}
                    >
                        <svg
                            ref={popupArrowRef}
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="8"
                            className={classNames(
                                "absolute translate-x-1/2",
                                isArrowAbove ? "-top-[8px]" : "-bottom-[8px] rotate-180"
                            )}
                            color="var(--color-bg-modal)"
                        >
                            <path
                                d="M 12.833 1.333 C 13.451 0.627 14.549 0.627 15.167 1.333 L 18.012 4.585 C 19.911 6.755 22.654 8 25.538 8 L 28 8 L 0 8 L 2.462 8 C 5.346 8 8.089 6.755 9.988 4.585 Z"
                                fill="currentColor"
                            ></path>
                        </svg>
                        <ImageButtons image={activeImage} row onButtonClick={() => changeActiveImage(null, null)} />
                    </div>
                </div>
            )}
        </div>
    )
}

function TableHeading({ children, className }) {
    return <th className={classNames("text-tertiary hover:text-primary font-medium", className)}>{children}</th>
}

function TableRow({ row, columns, isLastRow = false, activeImage, changeActiveImage }) {
    const imageElements = useRef([])

    return (
        <tr
            className={classNames(
                "h-10 text-secondary hover:text-primary font-medium",
                !isLastRow && "border-b border-divider"
            )}
        >
            <td className="text-nowrap pr-3 max-w-[200px] truncate">{row.title}</td>
            {columns.map(columnName => (
                <td>
                    <div className="flex-row gap-2 h-10">
                        {Array.isArray(row.columns?.[columnName])
                            ? row.columns[columnName].map((image, index) => (
                                  <div
                                      className="flex-col center w-10 h-full shrink-0 cursor-pointer"
                                      ref={el => (imageElements.current[index] = el)}
                                      onClick={() => changeActiveImage(image, imageElements.current[index])}
                                  >
                                      <div
                                          className={classNames(
                                              "w-full h-[22px] relative rounded-[4px] overflow-hidden bg-secondary transition-transform",
                                              activeImage === image && "scale-110"
                                          )}
                                      >
                                          <img
                                              src={`${image.url}?scale-down-to=512`}
                                              alt={image.altText}
                                              className="size-full object-cover"
                                              draggable={false}
                                          />
                                          <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
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
