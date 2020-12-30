import { DockerImage, Export, Exportjob } from "../schema/__generated__/graphql";
import Trainer from "./Trainer";
import PseudoDatabase from "../datasources/PseudoDatabase";
import { ProjectData } from "../datasources/PseudoDatabase";
import { Checkpoint } from "../store";
import { Container } from "dockerode";
import Docker from "./Docker";
import * as path from "path";
import * as fs from "fs";
import * as mkdirp from "mkdirp";

export default class Exporter {
  static readonly images: Record<string, DockerImage> = {
    export: { name: "gcperkins/wpilib-ml-tflite", tag: "latest" }
  };

  readonly project: ProjectData;
  readonly docker: Docker;
  ckptID: string;
  exp: Export;

  public constructor(project: ProjectData, docker: Docker, ckptID: string, exptName: string) {
    this.ckptID = ckptID;
    this.project = project;
    this.docker = docker;
    this.exp = this.createExport(exptName);
  }

  /**
   * Move checkpoint to the correct place in the mounted directory if needed.
   */
  public async mountCheckpoint(): Promise<void> {
    const checkpoint = await Checkpoint.findByPk(this.ckptID);
    const mountedPath = path.posix.join(this.project.directory, "train", `model.ckpt-${checkpoint.step}`);
    if (!(await Exporter.checkpointExists(mountedPath))) await Trainer.copyCheckpoint(checkpoint.path, mountedPath);
  }

  /**
   * Verify that a checkpoint exists.
   *
   * @param path The full path to the checkpoint, without the file extensions.
   */
  public static async checkpointExists(path: string): Promise<boolean> {
    async function checkpointFileExists(extention: string) {
      return new Promise((resolve) => fs.exists(path.concat(extention), resolve));
    }
    return (
      await Promise.all([
        checkpointFileExists(".data-00000-of-00001"),
        checkpointFileExists(".index"),
        checkpointFileExists(".meta")
      ])
    ).every(Boolean);
  }

  /**
   * Create the Export object to be stored in the Exporter instance.
   *
   * @param name The desired name of the exported tarfile.
   */
  private createExport(name: string): Export {
    const TARFILE_NAME = `${name}.tar.gz`;
    const RELATIVE_DIR_PATH = path.posix.join("exports", name);
    const FULL_DIR_PATH = path.posix.join(this.project.directory, RELATIVE_DIR_PATH);
    const DOWNLOAD_PATH = path.posix.join(FULL_DIR_PATH, TARFILE_NAME).split("/server/data/")[1]; //<- need to do this better
    return {
      id: name, //<-- id should be the IDv4 when moved to sequelize
      name: name,
      projectId: this.project.id,
      directory: FULL_DIR_PATH,
      tarfileName: TARFILE_NAME,
      downloadPath: DOWNLOAD_PATH,
      relativeDirPath: RELATIVE_DIR_PATH
    };
  }

  /**
   * Create the direcory to hold the export and its checkpoint.
   * Uses the Export previously saved in the Exporter instance for the necessary information.
   */
  public async createDestinationDirectory(): Promise<void> {
    await mkdirp(path.posix.join(this.exp.directory, "checkpoint"));
  }

  /**
   * Create parameter file in the mounted directory to control the export container.
   */
  public async writeParameterFile(): Promise<void> {
    const checkpoint = await Checkpoint.findByPk(this.ckptID);
    const exportparameters = {
      name: this.exp.name,
      epochs: checkpoint.step,
      "export-dir": this.exp.relativeDirPath
    };
    fs.writeFileSync(
      path.posix.join(this.project.directory, "exportparameters.json"),
      JSON.stringify(exportparameters)
    );
  }

  /**
   * Run the export container.
   */
  public async exportCheckpoint(): Promise<void> {
    const container: Container = await this.docker.createContainer(this.project, Exporter.images.export);
    await this.docker.runContainer(container);
  }

  /**
   * Save the previously stored Export object to the database.
   */
  public async saveExport(): Promise<void> {
    this.project.exports[this.exp.id] = this.exp;
    await PseudoDatabase.pushProject(this.project);
  }

  public getJob(): Exportjob {
    return {
      projectID: this.project.id,
      checkpointID: this.ckptID,
      exportID: this.exp.id
    };
  }

  public async print(): Promise<string> {
    return `Exportjob: ${this.exp.id}`;
  }
}
