import { Event } from "../event/Event";
import { Controller } from "./Controller";
import { GComponent } from "./GComponent";
import { GObject } from "./GObject";
import { GTree } from "./GTree";

export class GTreeNode {
    public data?: any;

    private _parent: GTreeNode;
    private _children: Array<GTreeNode>;
    private _expanded: boolean = false;
    private _level: number = 0;
    private _indentLevel: number = 0;
    private _addIndent?: number;
    private _tree: GTree;
    private _cell: GComponent;
    private _indentObj: GObject;
    private _resURL?: string;
    private _leafController: Controller;
    private _isFolder: boolean;

    public onExpanded?: (expand: boolean) => void;

    /** @internal */
    public _cellFromPool?: boolean;

    constructor(isFolder?: boolean, resURL?: string, addIndent?: number) {
        this._isFolder = isFolder;
        if (resURL)
            this._resURL = resURL;
        if (addIndent)
            this._addIndent = addIndent;
        this._children = [];
    }

    public set expanded(value: boolean) {
        if (this._expanded != value) {
            this._expanded = value;

            if (this._tree && this.isFolder) {
                if (this._expanded)
                    this._tree._afterExpanded(this);
                else
                    this._tree._afterCollapsed(this);
            }

            if (this._cell) {
                let cc = this._cell.getController("expanded");
                if (cc) {
                    cc.selectedIndex = this.expanded ? 1 : 0;
                }
            }
        }
    }

    public get expanded(): boolean {
        return this._expanded;
    }

    public get isFolder(): boolean {
        return this._isFolder || this._children.length > 0;
    }

    public set isFolder(value: boolean) {
        if (this._isFolder != value) {
            this._isFolder = value;
            if (this._leafController)
                this._leafController.selectedIndex = this.isFolder ? 0 : 1;
        }
    }

    public get parent(): GTreeNode {
        return this._parent;
    }

    public get text(): string {
        if (this._cell)
            return this._cell.text;
        else
            return null;
    }

    public set text(value: string) {
        if (this._cell)
            this._cell.text = value;
    }

    public get icon(): string {
        if (this._cell)
            return this._cell.icon;
        else
            return null;
    }

    public set icon(value: string) {
        if (this._cell)
            this._cell.icon = value;
    }

    public get cell(): GComponent {
        return this._cell;
    }

    public set cell(value: GComponent) {
        if (this._cell) {
            this._cell._treeNode = null;

            let cc = this._cell.getController("expanded");
            if (cc)
                cc.off("status_changed", this.__expandedStateChanged, this);

            let btn = this._cell.getChild("expandButton");
            if (btn)
                btn.off("click", this.__clickExpandButton, this);

            this._cell.off("pointer_down", this.__cellMouseDown, this);
        }

        this._cell = value;
        this._cellFromPool = false;

        if (this._cell) {
            this._cell._treeNode = this;

            this._indentObj = this._cell.getChild("indent");
            if (this._tree && this._indentObj)
                this._indentObj.width = Math.max(this._indentLevel - 1, 0) * this._tree.indent;

            let cc = this._cell.getController("expanded");
            if (cc) {
                cc.on("status_changed", this.__expandedStateChanged, this);
                cc.selectedIndex = this.expanded ? 1 : 0;
            }

            let btn = this._cell.getChild("expandButton");
            if (btn)
                btn.on("click", this.__clickExpandButton, this);

            this._leafController = this._cell.getController("leaf");
            if (this._leafController)
                this._leafController.selectedIndex = this.isFolder ? 0 : 1;

            this._cell.on("pointer_down", this.__cellMouseDown, this);
        }
    }

    public createCell() {
        if (this._cell)
            return;

        var child: GComponent = <GComponent>this._tree.getFromPool(this._resURL ? this._resURL : this._tree.defaultItem);
        if (!child)
            throw new Error("cannot create tree node object.");

        this.cell = child;
        this._cellFromPool = true;
    }

    public get level(): number {
        return this._level;
    }

    public addChild(child: GTreeNode): GTreeNode {
        this.addChildAt(child, this._children.length);
        return child;
    }

    public addChildAt(child: GTreeNode, index: number): GTreeNode {
        if (!child)
            throw new Error("child is null");

        var numChildren: number = this._children.length;

        if (index >= 0 && index <= numChildren) {
            if (child._parent == this) {
                this.setChildIndex(child, index);
            }
            else {
                if (child._parent)
                    child._parent.removeChild(child);

                if (index == numChildren)
                    this._children.push(child);
                else
                    this._children.splice(index, 0, child);

                if (this.isFolder && this._leafController)
                    this._leafController.selectedIndex = 0;

                child._parent = this;
                child._level = this._level + 1;
                child._indentLevel = this._indentLevel + 1 + (child._addIndent != null ? child._addIndent : 0);
                child._setTree(this._tree);
                if (this._tree && this == this._tree.rootNode || this._cell && this._cell.parent && this._expanded)
                    this._tree._afterInserted(child);
            }

            return child;
        }
        else {
            throw new RangeError("Invalid child index");
        }
    }

    public removeChild(child: GTreeNode): GTreeNode {
        var childIndex: number = this._children.indexOf(child);
        if (childIndex != -1) {
            this.removeChildAt(childIndex);
        }
        return child;
    }

    public removeChildAt(index: number): GTreeNode {
        if (index >= 0 && index < this.numChildren) {
            var child: GTreeNode = this._children[index];
            this._children.splice(index, 1);

            if (!this.isFolder && this._leafController)
                this._leafController.selectedIndex = 1;

            child._parent = null;
            if (this._tree) {
                child._setTree(null);
                this._tree._afterRemoved(child);
            }

            return child;
        }
        else {
            throw "Invalid child index";
        }
    }

    public removeChildren(beginIndex?: number, endIndex?: number): void {
        beginIndex = beginIndex || 0;
        if (endIndex == null) endIndex = -1;
        if (endIndex < 0 || endIndex >= this.numChildren)
            endIndex = this.numChildren - 1;

        for (var i: number = beginIndex; i <= endIndex; ++i)
            this.removeChildAt(beginIndex);
    }

    public getChildAt(index: number): GTreeNode {
        if (index >= 0 && index < this.numChildren)
            return this._children[index];
        else
            throw "Invalid child index";
    }

    public getChildIndex(child: GTreeNode): number {
        return this._children.indexOf(child);
    }

    public getPrevSibling(): GTreeNode {
        if (this._parent == null)
            return null;

        var i: number = this._parent._children.indexOf(this);
        if (i <= 0)
            return null;

        return this._parent._children[i - 1];
    }

    public getNextSibling(): GTreeNode {
        if (this._parent == null)
            return null;

        var i: number = this._parent._children.indexOf(this);
        if (i < 0 || i >= this._parent._children.length - 1)
            return null;

        return this._parent._children[i + 1];
    }

    public setChildIndex(child: GTreeNode, index: number): void {
        var oldIndex: number = this._children.indexOf(child);
        if (oldIndex == -1)
            throw "Not a child of this container";

        var cnt: number = this._children.length;
        if (index < 0)
            index = 0;
        else if (index > cnt)
            index = cnt;

        if (oldIndex == index)
            return;

        this._children.splice(oldIndex, 1);
        this._children.splice(index, 0, child);
        if (this._tree && this == this._tree.rootNode || this._cell && this._cell.parent && this._expanded)
            this._tree._afterMoved(child);
    }

    public swapChildren(child1: GTreeNode, child2: GTreeNode): void {
        var index1: number = this._children.indexOf(child1);
        var index2: number = this._children.indexOf(child2);
        if (index1 == -1 || index2 == -1)
            throw "Not a child of this container";
        this.swapChildrenAt(index1, index2);
    }

    public swapChildrenAt(index1: number, index2: number): void {
        var child1: GTreeNode = this._children[index1];
        var child2: GTreeNode = this._children[index2];

        this.setChildIndex(child1, index2);
        this.setChildIndex(child2, index1);
    }

    public get numChildren(): number {
        return this._children.length;
    }

    public getChildren(): ReadonlyArray<GTreeNode> {
        return this._children;
    }

    public expandToRoot(): void {
        var p: GTreeNode = this;
        while (p) {
            p.expanded = true;
            p = p.parent;
        }
    }

    public get tree(): GTree {
        return this._tree;
    }

    public _setTree(value: GTree): void {
        this._tree = value;

        if (this._tree && this._indentObj)
            this._indentObj.width = Math.max(this._indentLevel - 1, 0) * this._tree.indent;

        if (this._tree && this._tree.treeNodeWillExpand && this._expanded)
            this._tree.treeNodeWillExpand(this, true);

        var cnt: number = this._children.length;
        for (var i: number = 0; i < cnt; i++) {
            var node: GTreeNode = this._children[i];
            node._level = this._level + 1;
            node._indentLevel = this._indentLevel + 1 + (node._addIndent != null ? node._addIndent : 0);
            node._setTree(value);
        }
    }

    private __expandedStateChanged(evt: Event): void {
        let cc: Controller = <Controller>evt.target;
        this.expanded = cc.selectedIndex == 1;
    }

    private __cellMouseDown(evt: Event): void {
        if (this._tree && this.isFolder)
            this._tree._expandedStatusInEvt = this._expanded;
    }

    private __clickExpandButton(evt: Event): void {
        //dont set selection if click on the expand button
        evt.stopPropagation();
    }
}
