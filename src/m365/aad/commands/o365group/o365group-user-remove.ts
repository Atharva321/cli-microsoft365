import { Cli, Logger } from '../../../../cli';
import {
  CommandOption
} from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import Utils from '../../../../Utils';
import GraphCommand from '../../../base/GraphCommand';
import teamsCommands from '../../../teams/commands';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface UserResponse {
  value: string
}

interface Options extends GlobalOptions {
  teamId?: string;
  groupId?: string;
  userName: string;
  confirm?: boolean;
}

class AadO365GroupUserRemoveCommand extends GraphCommand {
  public get name(): string {
    return commands.O365GROUP_USER_REMOVE;
  }

  public get description(): string {
    return 'Removes the specified user from specified Microsoft 365 Group or Microsoft Teams team';
  }

  public alias(): string[] | undefined {
    return [teamsCommands.USER_REMOVE];
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.confirm = (!(!args.options.confirm)).toString();
    telemetryProps.teamId = typeof args.options.teamId !== 'undefined';
    telemetryProps.groupId = typeof args.options.groupId !== 'undefined';
    return telemetryProps;
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    const groupId: string = (typeof args.options.groupId !== 'undefined') ? args.options.groupId : args.options.teamId as string;

    const removeUser: () => void = async (): Promise<void> => {
      try {
        // retrieve user
        const user: UserResponse = await request.get({
          url: `${this.resource}/v1.0/users/${encodeURIComponent(args.options.userName)}/id`,
          headers: {
            accept: 'application/json;odata.metadata=none'
          },
          responseType: 'json'
        });

        // used to verify if the group exists or not
        await request.get({
          url: `${this.resource}/v1.0/groups/${groupId}/id`,
          headers: {
            'accept': 'application/json;odata.metadata=none'
          }
        });

        try {
          // try to delete the user from the owners. Accepted error is 404
          await request.delete({
            url: `${this.resource}/v1.0/groups/${groupId}/owners/${user.value}/$ref`,
            headers: {
              'accept': 'application/json;odata.metadata=none'
            }
          });
        }
        catch (err: any) {
          // the 404 error is accepted
          if (err.response.status !== 404) {
            throw err.response.data;
          }
        }
        
        // try to delete the user from the members. Accepted error is 404
        try {
          await request.delete({
            url: `${this.resource}/v1.0/groups/${groupId}/members/${user.value}/$ref`,
            headers: {
              'accept': 'application/json;odata.metadata=none'
            }
          });
        }
        catch (err: any) {
          // the 404 error is accepted
          if (err.response.status !== 404) {
            throw err.response.data;
          }
        }

        cb();
      }
      catch (err: any) {
        this.handleRejectedODataJsonPromise(err, logger, cb);
      }
    };

    if (args.options.confirm) {
      removeUser();
    }
    else {
      Cli.prompt({
        type: 'confirm',
        name: 'continue',
        default: false,
        message: `Are you sure you want to remove ${args.options.userName} from the ${(typeof args.options.groupId !== 'undefined' ? 'group' : 'team')} ${groupId}?`
      }, (result: { continue: boolean }): void => {
        if (!result.continue) {
          cb();
        }
        else {
          removeUser();
        }
      });
    }
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: "-i, --groupId [groupId]"
      },
      {
        option: "--teamId [teamId]"
      },
      {
        option: '-n, --userName <userName>'
      },
      {
        option: '--confirm'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    if (!args.options.groupId && !args.options.teamId) {
      return 'Please provide one of the following parameters: groupId or teamId';
    }

    if (args.options.groupId && args.options.teamId) {
      return 'You cannot provide both a groupId and teamId parameter, please provide only one';
    }

    if (args.options.teamId && !Utils.isValidGuid(args.options.teamId as string)) {
      return `${args.options.teamId} is not a valid GUID`;
    }

    if (args.options.groupId && !Utils.isValidGuid(args.options.groupId as string)) {
      return `${args.options.groupId} is not a valid GUID`;
    }

    return true;
  }
}

module.exports = new AadO365GroupUserRemoveCommand();